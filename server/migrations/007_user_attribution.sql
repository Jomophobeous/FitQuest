-- Migration 007: User attribution table for revenue attribution tracking
CREATE TABLE IF NOT EXISTS user_attribution (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  install_source text,
  install_campaign text,
  install_referrer text,
  first_open_at timestamptz,
  trial_started_at timestamptz,
  converted_at timestamptz,
  churn_at timestamptz,
  lifetime_value_usd numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
