/**
 * Analytics Service — PostHog revenue event tracking.
 *
 * Tracks subscription lifecycle events with standard properties.
 * Best-effort: never blocks UX on analytics failures.
 */

// PostHog may or may not be configured — fail silently
let posthog: { capture: (event: string, properties?: Record<string, unknown>) => void } | null = null;

try {
  // Dynamic import to avoid crash if posthog-react-native isn't installed

  const ph = require('posthog-react-native');
  posthog = ph.default || ph;
} catch {
  // PostHog not available — analytics disabled
}

interface RevenueEventProps {
  user_id: string;
  product_id?: string;
  price_usd?: number;
  source?: string;
}

function track(event: string, props: RevenueEventProps): void {
  try {
    posthog?.capture(event, {
      ...props,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Silent — analytics must never crash the app
  }
}

export function trackTrialStarted(props: RevenueEventProps): void {
  track('subscription_trial_started', props);
}

export function trackSubscriptionConverted(props: RevenueEventProps): void {
  track('subscription_converted', props);
}

export function trackSubscriptionCancelled(props: RevenueEventProps): void {
  track('subscription_cancelled', props);
}

export function trackSubscriptionExpired(props: RevenueEventProps): void {
  track('subscription_expired', props);
}

export function trackPaywallViewed(props: RevenueEventProps): void {
  track('paywall_viewed', props);
}

export function trackPaywallDismissed(props: RevenueEventProps): void {
  track('paywall_dismissed', props);
}
