import { createViewModel } from './createViewModel';

export const usePaywallViewModel = createViewModel(() => {
  const trackDismiss = () => {};
  const trackPurchase = (_plan: 'monthly' | 'annual') => {};

  return { trackPurchase, trackDismiss };
});
