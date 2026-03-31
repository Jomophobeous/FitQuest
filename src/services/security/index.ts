/**
 * Security services barrel export — Phase 18.
 */
export {
  tamperEngine,
  type RiskLevel,
  type VerificationConfidence,
  type TamperSignals,
  type DeviceContext,
  type SessionMetrics,
} from './tamperEngine';
export { degradation } from './degradation';
export {
  sentinelRecordAIAccess,
  sentinelRecordNetworkCall,
  sentinelRecordConnectivity,
  sentinelIsOnline,
  sentinelRecordPremiumAccess,
  sentinelVerifyEngine,
  sentinelGetAnomalyScore,
  sentinelShouldDegrade,
  microCheckTiming,
  microCheckStateCoherence,
  microCheckNavPattern,
  microCheckEntropy,
} from './sentinel';
export {
  querySecurityBridge,
  receiveBridgeDirective,
  isBridgeKillSwitchActive,
  queueReconciliationBatch,
  getPendingReconciliationBatches,
  clearPendingReconciliationBatches,
  receiveBridgeReconciliation,
  getLastReconciliationDirective,
  shouldAttemptVerification,
  isBridgeAvailable,
  dispatchBridgeVerification,
  recordVerificationSuccess,
  getLastVerificationResponse,
  getBridgeMetrics,
  type ReconciliationBatch,
  type ReconciliationDirective,
  type BridgeVerificationRequest,
  type BridgeVerificationResponse,
  type BridgeMetrics,
} from './securityBridge';
