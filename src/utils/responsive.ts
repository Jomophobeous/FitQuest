/**
 * Responsive utilities for universal screen size support.
 * Base design: 375×812 (iPhone SE / standard mobile).
 * Scales proportionally to tablets, small phones, and large screens.
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Scale a value based on screen width ratio.
 * Use for horizontal spacing, widths, horizontal padding.
 */
export function wp(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
}

/**
 * Scale a value based on screen height ratio.
 * Use for vertical spacing, heights, vertical padding.
 */
export function hp(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
}

/**
 * Moderate scaling — blends width-scale with a dampening factor.
 * Best for font sizes and icon sizes (prevents over-scaling on tablets).
 */
export function ms(size: number, factor: number = 0.5): number {
  return Math.round(PixelRatio.roundToNearestPixel(size + (wp(size) - size) * factor));
}

/**
 * Clamp a scaled value between min and max.
 */
export function clampScale(size: number, min: number, max: number): number {
  return Math.min(Math.max(ms(size), min), max);
}

/**
 * Check if device is a tablet (> 600dp width).
 */
export const isTablet = SCREEN_WIDTH >= 600;

/**
 * Check if device is a small phone (< 360dp width).
 */
export const isSmallPhone = SCREEN_WIDTH < 360;

/**
 * Get the number of grid columns based on screen width.
 * - Small phone: 1 column
 * - Phone: 2 columns
 * - Tablet: 3 columns
 * - Large tablet: 4 columns
 */
export function getGridColumns(): number {
  if (SCREEN_WIDTH >= 1024) return 4;
  if (SCREEN_WIDTH >= 600) return 3;
  if (SCREEN_WIDTH < 360) return 1;
  return 2;
}

/**
 * Get responsive card width for a grid layout.
 * Accounts for padding and gap.
 */
export function getCardWidth(columns?: number, padding: number = 16, gap: number = 12): number {
  const cols = columns ?? getGridColumns();
  return Math.floor((SCREEN_WIDTH - padding * 2 - gap * (cols - 1)) / cols);
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };
