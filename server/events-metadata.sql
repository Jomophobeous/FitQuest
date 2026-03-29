-- Phase 22: Add metadata column to events table for flexible anomaly data
-- Run in Supabase SQL Editor

ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata text;
