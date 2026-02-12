# Monetization Playbook

## Current State
- Paywall UI exists with monthly/annual pricing.
- Trial onboarding and notification cadence exist.
- RevenueCat integration wired with production keys.
- Entitlement validation + restore flow still need verification.

## Gaps
- Receipt validation strategy (offline-first) not fully defined.
- Feature gating not enforced consistently across modules.
- No conversion analytics funnel or A/B testing.

## Revenue Opportunities
1) Trial-to-paid conversion
- Gate high-value features after Day 7 with soft lock.
- Add progress-based nudges (workouts completed, books read, streak).

2) Plan economics
- Annual plan set as default with clear savings anchor.
- Add localized pricing and currency support.

3) Feature teasing
- Show blurred premium insights on analytics.
- Show locked FitMind features (e.g., advanced summaries).

4) Retention-driven upsell
- Trigger paywall after a user reaches a 3-day streak.
- Add in-app reminders when trial ends.

## Offline License Model
- Cache receipt or entitlement in SecureStore with expiry.
- Allow 3-7 days of grace for offline use.

## Implementation Steps (P0/P1)
- RevenueCat dependency configured with real keys and entitlements.
- Implement entitlement checks in subscription context.
- Add paywall entry points from high-intent screens.
- Add conversion analytics events (offline-first, user consent).
