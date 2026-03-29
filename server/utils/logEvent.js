/**
 * Event logger — Phase 22.3
 * Writes to Supabase events table with JSONB metadata.
 * Fire-and-forget: never blocks request flow, never throws.
 *
 * High-severity events are flagged for immediate alerting.
 * Anomaly evaluation is triggered on user/device events via the engine.
 *
 * Severity levels for audit:
 *   - HIGH_SEVERITY_EVENTS: logged with severity flag for immediate review
 */
'use strict';

const supabase = require('./supabaseClient');

// Events that warrant immediate alerting / separate high-severity logging
const HIGH_SEVERITY_EVENTS = new Set([
  'access_suspended',
  'device_untrusted',
  'ai_blocked_anomaly',
  'anomaly_detected',
  'subscription_force_reverify',
  'device_user_mismatch',
  'device_user_switch',
  'ai_rate_limited',
]);

async function logEvent(user_id, device_id, event_type, ip, metadata) {
  try {
    const isHighSeverity = HIGH_SEVERITY_EVENTS.has(event_type);
    const enrichedMetadata = metadata
      ? { ...metadata, _severity: isHighSeverity ? 'HIGH' : 'NORMAL', _logged_at: new Date().toISOString() }
      : isHighSeverity
        ? { _severity: 'HIGH', _logged_at: new Date().toISOString() }
        : undefined;

    const row = {
      user_id: user_id || null,
      device_id: device_id || null,
      event_type,
      ip: ip || null,
    };
    if (enrichedMetadata) row.metadata = enrichedMetadata;

    const { error } = await supabase.from('events').insert(row);
    // If metadata column doesn't exist yet, retry without it
    if (error && enrichedMetadata && /metadata/.test(error.message)) {
      delete row.metadata;
      await supabase.from('events').insert(row);
    }

    // Phase 22.3: high-severity events also logged to separate audit record
    if (isHighSeverity) {
      await supabase.from('events').insert({
        user_id: user_id || null,
        device_id: device_id || null,
        event_type: `audit_${event_type}`,
        ip: ip || null,
        metadata: { ...enrichedMetadata, _audit: true },
      }).catch(() => {}); // Silent — audit logging never blocks
    }
  } catch (_e) {
    // Silent — logging must never break request flow
  }
}

module.exports = logEvent;
module.exports.HIGH_SEVERITY_EVENTS = HIGH_SEVERITY_EVENTS;
