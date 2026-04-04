/**
 * Tamper Engine Stub — no-op security monitoring
 */
export const tamperEngine = {
  recordAIFeatureUsed: () => {},
  recordPremiumFeatureUsed: () => {},
  recordAIRequestSent: () => {},
  recordAIResponseReceived: () => {},
  recordConnectivitySignal: () => {},
  recordConnectivityFailure: () => {},
  updateEntitlementState: (_active: boolean) => {},
  updateVerificationConfidence: (_level: string) => {},
  requestBridgeVerification: () => {},
  getHeartbeatCounter: () => 0,
  getRiskLevel: () => 'none' as string,
  getSessionMetrics: () => ({
    reconciliationPending: false,
    offlineSignals: [],
    shadowFlags: {},
    offlineDurationMs: 0,
    riskScore: 0,
    deviceContext: {},
    createdAt: Date.now(),
  }),
  recordTelemetryEvent: () => {},
};
