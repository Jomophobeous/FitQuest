# RNG Usage Policy

## Security-Sensitive Randomness

Security-sensitive identifiers and token-like values use cryptographic randomness via Expo crypto primitives:

- `src/security/randomId.ts` → `generateSecureId()`
- Core usage migrated in:
  - `src/database/service.ts`
  - `src/engines/progressionEngine.ts`
  - `src/engines/workoutGenerator.ts`
  - `src/hooks/usePedometer.ts`

## Non-Sensitive Randomness

The following `Math.random()` usages remain intentionally non-security-critical and are retained for algorithmic behavior only (sampling/shuffling/synthetic noise/user-facing variability):

- AI scoring and UX response variation
- Federated learning simulation noise/shuffle
- Non-auth, non-token, non-secret model utility behavior

These values are never used for credentials, secrets, authentication, or encryption.
