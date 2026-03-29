/**
 * Silent event logger — writes to Supabase events table.
 * Fire-and-forget: never blocks request flow, never throws.
 * metadata (5th arg) is optional — stored as JSONB.
 */
'use strict';

const supabase = require('./supabaseClient');

async function logEvent(user_id, device_id, event_type, ip, metadata) {
  try {
    const row = {
      user_id: user_id || null,
      device_id: device_id || null,
      event_type,
      ip: ip || null,
    };
    if (metadata) row.metadata = metadata;
    const { error } = await supabase.from('events').insert(row);
    // If metadata column doesn't exist yet, retry without it
    if (error && metadata && /metadata/.test(error.message)) {
      delete row.metadata;
      await supabase.from('events').insert(row);
    }
  } catch (_e) {
    // Silent — logging must never break request flow
  }
}

module.exports = logEvent;
