# Monetization Test Matrix (Lite)

- Generated at: 2026-03-11T15:27:27.922Z
- Overall: PASS

## Automated Contract Checks
| Check | Result |
|---|---|
| revenuecat.env_key | PASS |
| entitlement.validation | PASS |
| restore.flow | PASS |
| offline.grace.rule | PASS |
| offline.cache.persisted | PASS |

## Manual Verification Matrix
| Scenario | Expected | Status |
|---|---|---|
| Fresh install trial start | `TRIAL` active with end date | Pending Manual |
| Monthly purchase | `ACTIVE` entitlement | Pending Manual |
| Annual purchase | `ACTIVE` entitlement | Pending Manual |
| Restore purchases | Previous entitlement restored | Pending Manual |
| RevenueCat unreachable within grace | Cached `offline_grace` access | Pending Manual |
| RevenueCat unreachable beyond grace | Fallback to local state | Pending Manual |