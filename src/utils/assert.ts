/**
 * Runtime assertion utilities for contract enforcement.
 *
 * Usage:
 *   invariant(userId, 'userId is required for DB write');
 *   invariant(amount > 0, 'amount must be positive');
 */

/**
 * Throws if condition is falsy. Use at system boundaries:
 * - Navigation params
 * - DB write preconditions
 * - Critical function arguments
 */
export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`[Invariant] ${message}`);
  }
}

/**
 * Asserts value is non-null/undefined and returns it typed.
 * Useful for inline assertions:
 *   const user = assertDefined(getUser(), 'user must exist');
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): T {
  invariant(value != null, message);
  return value;
}
