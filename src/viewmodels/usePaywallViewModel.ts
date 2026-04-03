import { useEffect, useRef } from 'react';
import { logPaywallViewed, logPaywallClosed, logPaywallConverted } from '../services/growthAnalytics';
import { createViewModel } from './createViewModel';

export const usePaywallViewModel = createViewModel(() => {
  const openedAtRef = useRef(Date.now());

  useEffect(() => {
    logPaywallViewed('manual');
  }, []);

  const trackDismiss = () => {
    logPaywallClosed(Date.now() - openedAtRef.current);
  };

  const trackPurchase = (plan: 'monthly' | 'annual') => {
    logPaywallConverted(plan, Date.now() - openedAtRef.current);
  };

  return { trackPurchase, trackDismiss };
});
