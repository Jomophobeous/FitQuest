require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  // Use OpenAPI spec to see the table definition
  const resp = await fetch(process.env.SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SERVICE_ROLE_KEY);
  const spec = await resp.json();
  const def = spec.definitions?.trust_alerts;
  if (def) {
    console.log('trust_alerts columns:', Object.keys(def.properties || {}).join(', '));
    console.log('required:', def.required?.join(', '));
  } else {
    console.log('trust_alerts not in OpenAPI spec');
    console.log('Available tables:', Object.keys(spec.definitions || {}).join(', '));
  }
  process.exit(0);
})();
