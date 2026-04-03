require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  const cols = ['id','user_id','device_id','alert_type','severity','trust_score','trust_score_at_alert','anomaly_count','anomaly_summary','metadata','status','resolved_by','resolved_at','resolution_notes','created_at','level','type','message','data','context','anomaly_score'];
  const found = [];
  for (const c of cols) {
    const { error } = await sb.from('trust_alerts').select(c).limit(0);
    if (error === null) found.push(c);
  }
  console.log('Existing columns:', found.join(', '));
})();
