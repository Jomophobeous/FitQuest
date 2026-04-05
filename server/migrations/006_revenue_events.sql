-- Migration 006: Revenue events table for RevenueCat webhook logging
CREATE TABLE IF NOT EXISTS revenue_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  event_type text NOT NULL,
  product_id text,
  revenue_usd numeric(10,2),
  currency text DEFAULT 'USD',
  entitlement text,
  expires_at timestamptz,
  raw_payload jsonb,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_user_id ON revenue_events(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_event_type ON revenue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_created_at ON revenue_events(created_at DESC);
