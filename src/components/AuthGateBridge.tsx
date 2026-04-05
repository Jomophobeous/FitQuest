/**
 * AuthGateBridge — Syncs AuthGate unlock state with AuthContext
 *
 * When the biometric/password gate unlocks, notify AuthContext
 * that the user is locally authenticated (no server token needed).
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthGateBridge() {
  const { markAsLocallyAuthenticated } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    // Sync once at mount — AuthGate has already unlocked before we render
    if (!synced.current) {
      synced.current = true;
      // Signal to AuthContext that user is locally authenticated
      markAsLocallyAuthenticated();
    }
  }, [markAsLocallyAuthenticated]);

  return null;
}
