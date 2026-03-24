#!/usr/bin/env bash
# ============================================================
# Health Connect Native Crash Prevention Patch
# ============================================================
# Patches react-native-health-connect to add:
#   1. isInitialized guard in HealthConnectPermissionDelegate
#   2. try-catch + delegate readiness check in HealthConnectManager
#
# Run automatically via postinstall or manually:
#   bash scripts/patch-health-connect.sh
# ============================================================

set -euo pipefail

DELEGATE_FILE="node_modules/react-native-health-connect/android/src/main/java/dev/matinzd/healthconnect/permissions/HealthConnectPermissionDelegate.kt"
MANAGER_FILE="node_modules/react-native-health-connect/android/src/main/java/dev/matinzd/healthconnect/HealthConnectManager.kt"

if [ ! -f "$DELEGATE_FILE" ]; then
  echo "[patch-health-connect] Delegate file not found — skipping (library not installed)"
  exit 0
fi

# ---------- PATCH 1: Add isPermissionDelegateReady() and isInitialized guards ----------

if grep -q "isPermissionDelegateReady" "$DELEGATE_FILE"; then
  echo "[patch-health-connect] Delegate already patched — skipping"
else
  echo "[patch-health-connect] Patching HealthConnectPermissionDelegate..."

  # Replace launchPermissionsDialog to add isInitialized guard
  sed -i 's/  suspend fun launchPermissionsDialog(permissions: Set<String>): Set<String> {/  fun isPermissionDelegateReady(): Boolean {\n    return this::requestPermission.isInitialized\n  }\n\n  suspend fun launchPermissionsDialog(permissions: Set<String>): Set<String> {\n    if (!this::requestPermission.isInitialized) {\n      throw IllegalStateException(\n        "HealthConnect permission delegate not initialized. " +\n        "Call HealthConnectPermissionDelegate.setPermissionDelegate(activity) in MainActivity.onCreate()."\n      )\n    }/' "$DELEGATE_FILE"

  # Replace launchExerciseRouteAccessRequestDialog to add isInitialized guard
  sed -i '/suspend fun launchExerciseRouteAccessRequestDialog/,/requestRoutePermission.launch(recordId)/{
    /requestRoutePermission.launch(recordId)/i\    if (!this::requestRoutePermission.isInitialized) {\n      throw IllegalStateException(\n        "HealthConnect route permission delegate not initialized. " +\n        "Call HealthConnectPermissionDelegate.setPermissionDelegate(activity) in MainActivity.onCreate()."\n      )\n    }
  }' "$DELEGATE_FILE"

  echo "[patch-health-connect] Delegate patched ✓"
fi

# ---------- PATCH 2: Add try-catch + delegate check in requestPermission ----------

if grep -q "isPermissionDelegateReady" "$MANAGER_FILE"; then
  echo "[patch-health-connect] Manager already patched — skipping"
else
  echo "[patch-health-connect] Patching HealthConnectManager..."

  # Add delegate readiness check and try-catch around the coroutine body
  sed -i '/fun requestPermission(/,/^  }$/{
    s/coroutineScope.launch {/if (!HealthConnectPermissionDelegate.isPermissionDelegateReady()) {\n        promise.reject(\n          "HEALTH_CONNECT_DELEGATE_NOT_READY",\n          "Permission delegate not initialized. Ensure setPermissionDelegate() is called in MainActivity.onCreate()."\n        )\n        return@throwUnlessClientIsAvailable\n      }\n      coroutineScope.launch {\n        try {/
    s/promise.resolve(PermissionUtils.mapPermissionResult(granted))/promise.resolve(PermissionUtils.mapPermissionResult(granted))\n        } catch (e: Exception) {\n          promise.reject("HEALTH_CONNECT_PERMISSION_ERROR", e.message, e)\n        }/
  }' "$MANAGER_FILE"

  echo "[patch-health-connect] Manager patched ✓"
fi

echo "[patch-health-connect] All patches applied successfully"
