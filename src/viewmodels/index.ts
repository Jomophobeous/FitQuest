/**
 * ViewModel Layer — Index
 *
 * This directory contains all screen ViewModels.
 * Each screen gets exactly ONE ViewModel hook that encapsulates:
 *   - All data loading (DB, services, engines)
 *   - All state management
 *   - All actions/mutations
 *
 * Screens import ONLY from here. Never from database/service, engines/, or security/.
 *
 * Pattern:
 *   export const useFooViewModel = createViewModel(() => {
 *     // all service access here
 *     return { state, actions };
 *   });
 */

export { createViewModel } from './createViewModel';
