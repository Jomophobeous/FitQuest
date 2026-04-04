/**
 * Trained Activity Classifier Stub
 * ML-based activity classification from sensor data.
 */

export interface SensorReading {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  ax?: number;
  ay?: number;
  az?: number;
  gx?: number;
  gy?: number;
  gz?: number;
}

export interface ClassificationResult {
  activity: string;
  confidence: number;
}

class TrainedActivityClassifier {
  loaded = false;

  async initialize(): Promise<boolean> {
    return false;
  }

  classifyWindow(_window: SensorReading[]): ClassificationResult | null {
    return null;
  }
}

export const trainedActivityClassifier = new TrainedActivityClassifier();
