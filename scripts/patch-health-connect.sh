#!/bin/bash
# Patch react-native-health-connect for compatibility
# This script is a no-op if the patch target doesn't exist

HEALTH_CONNECT_DIR="node_modules/react-native-health-connect"

if [ -d "$HEALTH_CONNECT_DIR" ]; then
  echo "Health Connect module found, checking for patches..."
  # Future patches go here
  echo "No patches needed."
else
  echo "Health Connect module not found, skipping patch."
fi
