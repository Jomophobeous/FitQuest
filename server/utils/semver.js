/**
 * Semver comparison utility — Phase 23.
 *
 * Fixes S4/S5: lexicographic version comparison ("2.10.0" < "2.9.0" = true)
 * replaced with proper numeric split-compare.
 */
'use strict';

/**
 * Compare two semver-like version strings.
 * Returns true if `current` is strictly less than `previous`.
 *
 * Examples:
 *   isVersionDowngrade("2.4.0", "2.5.0")  → true
 *   isVersionDowngrade("2.10.0", "2.9.0") → false
 *   isVersionDowngrade("2.5.0", "2.5.0")  → false
 *
 * @param {string} current
 * @param {string} previous
 * @returns {boolean}
 */
function isVersionDowngrade(current, previous) {
  if (!current || !previous) return false;
  const a = current.split('.').map(Number);
  const b = previous.split('.').map(Number);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (isNaN(av) || isNaN(bv)) return false; // non-numeric — can't compare
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false; // equal
}

module.exports = { isVersionDowngrade };
