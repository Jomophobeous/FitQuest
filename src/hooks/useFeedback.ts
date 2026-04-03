/**
 * Feedback — Clean facade over ToastContext.
 *
 * Provides the shorthand API:
 *   const feedback = useFeedback();
 *   feedback.success('Workout saved');
 *   feedback.error('Network failed');
 *   feedback.info('Offline mode');
 *   feedback.warn('Low battery');
 *
 * All calls delegate to the existing ToastProvider.
 * This is the ONLY feedback API components should use.
 */

import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';

export interface FeedbackAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

/**
 * Hook returning the unified feedback API.
 * Must be inside ToastProvider.
 */
export function useFeedback(): FeedbackAPI {
  const { showToast } = useToast();

  const success = useCallback(
    (message: string) => showToast({ message, type: 'success' }),
    [showToast],
  );

  const error = useCallback(
    (message: string) => showToast({ message, type: 'error', vibrate: true }),
    [showToast],
  );

  const info = useCallback(
    (message: string) => showToast({ message, type: 'info' }),
    [showToast],
  );

  const warn = useCallback(
    (message: string) => showToast({ message, type: 'warning' }),
    [showToast],
  );

  return { success, error, info, warn };
}
