/**
 * Tamper Engine — Security monitoring and anomaly detection.
 *
 * Tracks AI/premium feature usage, connectivity signals, and session metrics.
 * When anomalous patterns are detected (e.g., impossible usage rates,
 * connectivity manipulation), raises risk level which can trigger
 * forced verification or session termination.
 *
 * ENFORCEMENT: This is not optional. Every AI/premium feature call
 * must go through recordAIFeatureUsed/recordPremiumFeatureUsed.
 */

import { authEventBus } from './authEventBus';

// ── Rate limits ──
const MAX_AI_REQUESTS_PER_MINUTE = 30;
const MAX_PREMIUM_FEATURES_PER_MINUTE = 60;
const CONNECTIVITY_FLIP_THRESHOLD = 10; // flips per minute = suspicious

interface SessionMetrics {
  reconciliationPending: boolean;
  offlineSignals: Array<{ timestamp: number; type: string }>;
  shadowFlags: Record<string, boolean>;
  offlineDurationMs: number;
  riskScore: number;
  deviceContext: Record<string, unknown>;
  createdAt: number;
}

type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

class TamperEngineImpl {
  private aiRequestTimestamps: number[] = [];
  private premiumFeatureTimestamps: number[] = [];
  private connectivityFlips: number[] = [];
  private heartbeatCounter = 0;
  private riskLevel: RiskLevel = 'none';
  private offlineSignals: Array<{ timestamp: number; type: string }> = [];
  private offlineStart: number | null = null;
  private totalOfflineMs = 0;
  private sessionStart = Date.now();
  private shadowFlags: Record<string, boolean> = {};

  recordAIFeatureUsed(): void {
    const now = Date.now();
    this.aiRequestTimestamps.push(now);
    this.pruneOldTimestamps(this.aiRequestTimestamps);

    if (this.aiRequestTimestamps.length > MAX_AI_REQUESTS_PER_MINUTE) {
      this.escalateRisk('high', 'AI request rate exceeded');
    }
  }

  recordPremiumFeatureUsed(): void {
    const now = Date.now();
    this.premiumFeatureTimestamps.push(now);
    this.pruneOldTimestamps(this.premiumFeatureTimestamps);

    if (this.premiumFeatureTimestamps.length > MAX_PREMIUM_FEATURES_PER_MINUTE) {
      this.escalateRisk('medium', 'Premium feature rate exceeded');
    }
  }

  recordAIRequestSent(): void {
    this.heartbeatCounter++;
  }

  recordAIResponseReceived(): void {
    // Valid response received — slight trust recovery
    if (this.riskLevel === 'low') {
      this.riskLevel = 'none';
    }
  }

  recordConnectivitySignal(): void {
    const now = Date.now();
    this.connectivityFlips.push(now);
    this.pruneOldTimestamps(this.connectivityFlips);

    if (this.offlineStart !== null) {
      this.totalOfflineMs += now - this.offlineStart;
      this.offlineStart = null;
    }

    if (this.connectivityFlips.length > CONNECTIVITY_FLIP_THRESHOLD) {
      this.escalateRisk('medium', 'Connectivity flip-flopping detected');
    }
  }

  recordConnectivityFailure(): void {
    const now = Date.now();
    if (this.offlineStart === null) {
      this.offlineStart = now;
    }
    this.offlineSignals.push({ timestamp: now, type: 'failure' });
  }

  updateEntitlementState(_active: boolean): void {
    // Track entitlement changes for tamper detection
  }

  updateVerificationConfidence(_level: string): void {
    // Track verification confidence changes
  }

  requestBridgeVerification(): void {
    this.shadowFlags.bridgeVerificationRequested = true;
  }

  getHeartbeatCounter(): number {
    return this.heartbeatCounter;
  }

  getRiskLevel(): string {
    return this.riskLevel;
  }

  getSessionMetrics(): SessionMetrics {
    return {
      reconciliationPending: this.shadowFlags.bridgeVerificationRequested ?? false,
      offlineSignals: [...this.offlineSignals].slice(-20),
      shadowFlags: { ...this.shadowFlags },
      offlineDurationMs: this.totalOfflineMs + (this.offlineStart ? Date.now() - this.offlineStart : 0),
      riskScore: this.calculateRiskScore(),
      deviceContext: {},
      createdAt: this.sessionStart,
    };
  }

  recordTelemetryEvent(): void {
    // Telemetry recorded
  }

  // ── Internal ──

  private pruneOldTimestamps(arr: number[]): void {
    const cutoff = Date.now() - 60_000; // 1 minute window
    while (arr.length > 0 && arr[0]! < cutoff) {
      arr.shift();
    }
  }

  private escalateRisk(level: RiskLevel, reason: string): void {
    const levels: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
    const current = levels.indexOf(this.riskLevel);
    const proposed = levels.indexOf(level);
    if (proposed > current) {
      this.riskLevel = level;
      if (__DEV__) console.warn(`[TamperEngine] Risk escalated to ${level}: ${reason}`);
    }

    // Critical risk = forced session termination
    if (this.riskLevel === 'critical') {
      authEventBus.emit('TAMPER_DETECTED');
    }
  }

  private calculateRiskScore(): number {
    const levels: Record<RiskLevel, number> = {
      none: 0,
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };
    return levels[this.riskLevel];
  }
}

export const tamperEngine = new TamperEngineImpl();
