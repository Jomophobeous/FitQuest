# Tech Debt Register

Legend: P0 (critical), P1 (high), P2 (medium), P3 (low)

| ID | Priority | Area | Description | Evidence | Suggested Fix | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | P0 | FitMind Schema | `last_read_at` used, schema mismatch with canonical DB | FitMind service queries and table definitions diverge | Unify schema and remove `last_read_at` from queries | Done |
| TD-002 | P0 | Security | Health metrics stored plaintext | `heart_rate_readings` in schema.ts | Encrypt health metrics via encryptedDB | Done |
| TD-003 | P0 | Storage | AsyncStorage used for prefs and auth | Theme/Language contexts, apollo-client, offline-cache | Replace with SecureStore or SQLite | Done |
| TD-004 | P0 | Crypto | CTR+HMAC used instead of AES-GCM | AESEncryption | Implement AES-GCM + migration | Done |
| TD-005 | P0 | SQL Governance | Raw SQL outside schema/service | FitMind schema creation, SubscriptionManager | Move table creation into schema.ts | Done |
| TD-006 | P1 | SQL Injection | Dynamic table name in secureDelete | EncryptedDatabase | Whitelist allowed tables | Done |
| TD-007 | P1 | Monetization | RevenueCat production verification | SubscriptionManager | Verify entitlements + restore + offline policy | Done |
| TD-008 | P1 | Testing | Minimal tests only | package.json + CI | Expand unit/integration tests | Done |
| TD-009 | P1 | Theme | Hardcoded colors in some screens | paywall, meal-prep | Replace with theme tokens | Done |
| TD-010 | P2 | Observability | No Sentry / perf metrics | None | Add crash reporting + perf tracing | Done |
| TD-011 | P2 | ML Performance | No inference benchmarks | AI modules | Create benchmark harness | Done |
| TD-012 | P3 | RNG | Math.random for IDs | multiple modules | Replace with expo-random where needed | Done |
