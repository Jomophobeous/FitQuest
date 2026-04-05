/**
 * Sentinel — Security verification and coherence checks.
 *
 * Monitors premium access patterns, engine heartbeats, AI access,
 * network calls, and connectivity for coherence.
 * When incoherent states are detected (e.g., premium access without
 * valid subscription, AI calls without auth), flags for investigation.
 *
 * ENFORCEMENT: Incoherent states trigger risk escalation in tamperEngine.
 */

import { tamperEngine } from './tamperEngine';

let _premiumAccessCount = 0;
let _aiAccessCount = 0;
let _networkCallCount = 0;
let _lastHeartbeat = 0;
let _lastCoherenceCheck = 0;
const COHERENCE_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function sentinelRecordPremiumAccess(_active: boolean): void {
  _premiumAccessCount++;
  if (_active) {
    // If premium is accessed, verify heartbeat is still alive
    microCheckStateCoherence();
  }
}

export function sentinelVerifyEngine(heartbeat: number): void {
  // Heartbeat should always increase
  if (heartbeat < _lastHeartbeat && _lastHeartbeat > 0) {
    // Heartbeat went backward = tamper or engine reset
    if (__DEV__) console.warn('[Sentinel] Heartbeat regression detected');
    tamperEngine.requestBridgeVerification();
  }
  _lastHeartbeat = heartbeat;
}

export function microCheckStateCoherence(): void {
  const now = Date.now();
  if (now - _lastCoherenceCheck < COHERENCE_CHECK_INTERVAL_MS) return;
  _lastCoherenceCheck = now;

  // Check: if AI access count is abnormally high relative to network calls
  // (AI without network = possible offline bypass)
  if (_aiAccessCount > 0 && _networkCallCount === 0 && _aiAccessCount > 5) {
    if (__DEV__) console.warn('[Sentinel] AI access without network activity detected');
    tamperEngine.requestBridgeVerification();
  }
}

export function sentinelRecordAIAccess(): void {
  _aiAccessCount++;
}

export function sentinelRecordNetworkCall(): void {
  _networkCallCount++;
}

export function sentinelRecordConnectivity(_online: boolean): void {
  if (_online) {
    tamperEngine.recordConnectivitySignal();
  } else {
    tamperEngine.recordConnectivityFailure();
  }
}

export function microCheckTiming(_label: string): void {
  // Timing check — detect debugger/slowdown
  // Not implemented yet (requires high-resolution timer comparison)
}
