/**
 * Event logger — Phase 23 (P1 optimized)
 * Writes to Supabase events table with JSONB metadata.
 * Fire-and-forget: never blocks request flow, never throws.
 *
 * High-severity events are flagged via metadata._severity = 'HIGH'.
 * P1 optimization: removed duplicate audit_ prefix insert — single write
 * with severity flag is sufficient for filtering and alerting.
 *
 * Severity levels for audit:
 *   - HIGH_SEVERITY_EVENTS: logged with severity flag for immediate review
 */
'use strict';

const supabase = require('./supabaseClient');

// Events that warrant immediate alerting / high-severity flagging
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
    // P1: Removed duplicate audit_{event_type} insert.
    // High-severity events are queryable via: WHERE metadata->>'_severity' = 'HIGH'
  } catch (_e) {
    // Silent — logging must never break request flow
  }
}

module.exports = logEvent;
module.exports.HIGH_SEVERITY_EVENTS = HIGH_SEVERITY_EVENTS;
