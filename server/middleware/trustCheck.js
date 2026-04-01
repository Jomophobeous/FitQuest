/**
 * Trust scoring middleware — Phase 30 (Adaptive Response).
 *
 * Enforces trust thresholds + access profiles BEFORE endpoint logic executes.
 * Reads DB-persisted anomaly_score (set by anomalyEngine) — no per-request computation.
 *
 *   effective_score = trust_score - anomaly_score
 *
 * Phase 30 additions:
 *   - Adaptive response hook (friction, shadow, isolate, hard_restrict)
 *   - Response-aware feature gating
 *
 * Phase 29: Trust floor, premium protection, shadow mode
 * Phase 28: Access profiles, feature gates, offline window
 *
 * Attaches: req.user, req.device, req.restricted, req.degraded, req.softBlocked,
 *           req.effectiveTrust, req.anomalyScore, req.backendVerified,
 *           req.accessProfile, req.featureGate, req.adaptiveResponse.
 */
'use strict';

const supabase = require('../utils/supabaseClient');
const logEvent = require('../utils/logEvent');
const respond = require('../utils/respond');
const { checkThresholdsAndAlert, TRUST_THRESHOLDS } = require('../engines/trustDecayEngine');
const {
  getAccessProfile,
  getOverrideStatus,
  getFeatureGate,
  ACCESS_PROFILES,
  TRUST_BANDS,
  checkOfflineWindow,
  MAX_OFFLINE_WINDOW_HOURS,
  profileSeverity,
} = require('../engines/enforcementEngine');
const {
  getTrustFloor,
  applyPremiumProtection,
  isShadowModeEnabled,
  evaluateShadowMode,
  getReputation,
} = require('../engines/reputationEngine');
const { applyResponseToRequest } = require('../engines/responseEngine');

// ── Thresholds (Phase 27 compat) ──
const THRESHOLD_RESTRICTED = TRUST_THRESHOLDS.degraded;   // 0.6
const THRESHOLD_SOFT_BLOCK = TRUST_THRESHOLDS.softBlock;   // 0.3

async function trustCheck(req, res, next) {
  const { user_id, device_id } = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (!user_id || typeof user_id !== 'string') {
    return respond(res, 400, null, 'Missing or invalid "user_id" field.');
  }
  if (!device_id || typeof device_id !== 'string') {
    return respond(res, 400, null, 'Missing or invalid "device_id" field.');
  }

  const sanitizedUserId = user_id.trim().slice(0, 128);
  const sanitizedDeviceId = device_id.trim().slice(0, 256);

  try {
    // P1 optimization: parallel user + device DB reads (saves ~50ms per request)
    const [deviceResult, userResult] = await Promise.all([
      // Fetch device (anomaly_score may not exist yet if schema not updated)
      (async () => {
        const deviceQuery = await supabase
          .from('devices')
          .select('device_id, user_id, app_version, trust_score, anomaly_score, last_seen')
          .eq('device_id', sanitizedDeviceId)
          .maybeSingle();

        if (deviceQuery.error && deviceQuery.error.message?.includes('anomaly_score')) {
          const fallback = await supabase
            .from('devices')
            .select('device_id, user_id, app_version, trust_score, last_seen')
            .eq('device_id', sanitizedDeviceId)
            .maybeSingle();
          return { data: fallback.data, error: fallback.error };
        }
        return { data: deviceQuery.data, error: deviceQuery.error };
      })(),
      // Fetch user (anomaly_score may not exist yet if schema not updated)
      (async () => {
        const userQuery = await supabase
          .from('users')
          .select('id, email, trust_score, anomaly_score')
          .eq('id', sanitizedUserId)
          .maybeSingle();

        if (userQuery.error && userQuery.error.message?.includes('anomaly_score')) {
          const fallback = await supabase
            .from('users')
            .select('id, email, trust_score')
            .eq('id', sanitizedUserId)
            .maybeSingle();
          return { data: fallback.data, error: fallback.error };
        }
        return { data: userQuery.data, error: userQuery.error };
      })(),
    ]);

    const device = deviceResult.data;
    const deviceErr = deviceResult.error;
    const user = userResult.data;
    const userErr = userResult.error;

    if (deviceErr) {
      console.error('[trustCheck] Device lookup error:', deviceErr.message);
    }

    if (!device) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'unknown_device', ip);
      return respond(res, 403, null, 'Unknown device. Register first via /verify/device.');
    }

    if (device.user_id && device.user_id !== sanitizedUserId) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'device_user_mismatch', ip, {
        claimed_user: sanitizedUserId,
        actual_user: device.user_id,
      });
      return respond(res, 403, null, 'Device is not registered to this user.');
    }

    if (userErr) {
      console.error('[trustCheck] User lookup error:', userErr.message);
    }

    if (!user) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'unknown_user', ip);
      return respond(res, 403, null, 'Unknown user. Register first via /user/create.');
    }

    // ── Compute effective trust from DB-persisted scores ──
    const userTrust = Number(user.trust_score) || 1.0;
    const deviceTrust = Number(device.trust_score) || 1.0;
    const baseTrust = Math.min(userTrust, deviceTrust);

    // Use the higher of user-level or device-level anomaly score
    const anomalyScore = Math.max(
      Number(user.anomaly_score) || 0,
      Number(device.anomaly_score) || 0
    );

    const effectiveTrust = Math.max(0, Math.min(1.0, baseTrust - anomalyScore));

    // ── Phase 28: Check for admin override ──
    const override = getOverrideStatus(sanitizedUserId);
    let accessProfile;
    let overrideActive = false;

    if (override) {
      accessProfile = override.profile;
      overrideActive = true;
    } else {
      accessProfile = getAccessProfile(effectiveTrust);
    }

    // ── Phase 28: Anti-bypass — offline window check ──
    if (!overrideActive && device.last_seen) {
      const offlineExceeded = checkOfflineWindow(device.last_seen, MAX_OFFLINE_WINDOW_HOURS);
      if (offlineExceeded && profileSeverity(accessProfile) < profileSeverity(ACCESS_PROFILES.HARD_RESTRICT)) {
        accessProfile = ACCESS_PROFILES.HARD_RESTRICT;
        logEvent(sanitizedUserId, sanitizedDeviceId, 'offline_window_exceeded', ip, {
          last_seen: device.last_seen,
          max_hours: MAX_OFFLINE_WINDOW_HOURS,
        });
      }
    }

    // ── Phase 29: Trust floor enforcement ──
    if (!overrideActive) {
      const reputation = await getReputation(sanitizedUserId);
      const floor = getTrustFloor(reputation);
      if (floor.capped && effectiveTrust > floor.max_trust) {
        // Don't change effectiveTrust on req (read-only), but downgrade profile
        const flooredProfile = getAccessProfile(floor.max_trust);
        if (profileSeverity(flooredProfile) > profileSeverity(accessProfile)) {
          accessProfile = flooredProfile;
        }
      }

      // Phase 29: Premium protection
      const isPremium = await (async () => {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', sanitizedUserId)
          .eq('status', 'active')
          .maybeSingle();
        return !!(sub && sub.status === 'active');
      })();

      if (isPremium) {
        const prot = applyPremiumProtection(accessProfile, isPremium, userTrust);
        if (prot.protected) {
          accessProfile = prot.profile;
        }
      }

      // Phase 29: Shadow mode
      if (isShadowModeEnabled()) {
        evaluateShadowMode(sanitizedUserId, accessProfile).catch(() => {});
      }
    }

    // ── Phase 28: LOCKDOWN → hard 403 ──
    if (accessProfile === ACCESS_PROFILES.LOCKDOWN) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_lockdown', ip, {
        effective: effectiveTrust,
        anomaly_score: anomalyScore,
        override: overrideActive,
      });
      checkThresholdsAndAlert(sanitizedUserId, sanitizedDeviceId, effectiveTrust, anomalyScore);
      return respond(res, 403, null, 'Access denied. Account under review.');
    }

    const featureGate = getFeatureGate(accessProfile);

    // ── Phase 30: Adaptive response hook ──
    let adaptiveResponse = { applied: false, response_type: 'NONE', friction: null, features: null };
    try {
      adaptiveResponse = await applyResponseToRequest(sanitizedUserId);
      if (adaptiveResponse.applied) {
        // Merge response-level feature isolation into featureGate
        if (adaptiveResponse.features) {
          for (const [key, allowed] of Object.entries(adaptiveResponse.features)) {
            if (!allowed && featureGate[key] !== undefined) {
              featureGate[key] = false;
            }
          }
        }
        logEvent(sanitizedUserId, sanitizedDeviceId, 'adaptive_response_applied', ip, {
          response_type: adaptiveResponse.response_type,
          intensity: adaptiveResponse.intensity,
        });
      }
    } catch (respErr) {
      // Non-blocking — response engine failure must not break request flow
      console.error('[trustCheck] Adaptive response error:', respErr.message);
    }

    // ── Backward compat flags (Phase 27) ──
    const softBlocked = effectiveTrust < THRESHOLD_SOFT_BLOCK;
    const degraded = effectiveTrust < THRESHOLD_RESTRICTED;

    if (softBlocked || accessProfile === ACCESS_PROFILES.HARD_RESTRICT) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_hard_restricted', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
        access_profile: accessProfile,
        override: overrideActive,
      });
      checkThresholdsAndAlert(sanitizedUserId, sanitizedDeviceId, effectiveTrust, anomalyScore);
    } else if (degraded || accessProfile === ACCESS_PROFILES.SOFT_RESTRICT) {
      logEvent(sanitizedUserId, sanitizedDeviceId, 'access_soft_restricted', ip, {
        user_trust: userTrust,
        device_trust: deviceTrust,
        anomaly_score: anomalyScore,
        effective: effectiveTrust,
        access_profile: accessProfile,
      });
      checkThresholdsAndAlert(sanitizedUserId, sanitizedDeviceId, effectiveTrust, anomalyScore);
    }

    // ── Attach to request (Phase 28: add accessProfile + featureGate) ──
    req.user = user;
    req.device = device;
    req.restricted = degraded;       // backward compat
    req.degraded = degraded;         // Phase 27: clearer name
    req.softBlocked = softBlocked;   // Phase 27: soft block flag
    req.effectiveTrust = effectiveTrust;
    req.anomalyScore = anomalyScore;
    req.backendVerified = true;
    req.accessProfile = accessProfile;     // Phase 28
    req.featureGate = featureGate;         // Phase 28
    req.overrideActive = overrideActive;   // Phase 28
    req.adaptiveResponse = adaptiveResponse; // Phase 30

    logEvent(sanitizedUserId, sanitizedDeviceId, 'trust_check_passed', ip, {
      effective: effectiveTrust,
      anomaly_score: anomalyScore,
      access_profile: accessProfile,
      override: overrideActive,
      adaptive_response: adaptiveResponse.response_type,
    });

    // Phase 30: Apply friction delay (non-blocking latency injection)
    if (adaptiveResponse.applied && adaptiveResponse.friction && adaptiveResponse.friction.latency_ms > 0) {
      const delay = Math.min(adaptiveResponse.friction.latency_ms, 3000); // cap at 3s
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    next();
  } catch (err) {
    console.error('[trustCheck] Unexpected error:', err.message);
    return respond(res, 500, null, 'Internal server error.');
  }
}

module.exports = trustCheck;
module.exports.THRESHOLD_RESTRICTED = THRESHOLD_RESTRICTED;
module.exports.THRESHOLD_SOFT_BLOCK = THRESHOLD_SOFT_BLOCK;
