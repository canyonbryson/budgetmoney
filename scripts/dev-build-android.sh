#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
PACKAGE_NAME="com.canyonortho.grocerybudget"

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: adb is not installed or not in PATH."
  exit 1
fi

DEVICE_SERIAL="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [[ -z "${DEVICE_SERIAL:-}" ]]; then
  echo "Error: no connected Android device found."
  exit 1
fi

echo "Using Android device: $DEVICE_SERIAL"
echo "Uninstalling existing app (if present) to avoid version downgrade issues..."
adb -s "$DEVICE_SERIAL" uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true

echo "Building and installing debug app..."
(
  cd "$ANDROID_DIR"
  ANDROID_HOME="$ANDROID_SDK" ANDROID_SDK_ROOT="$ANDROID_SDK" ./gradlew installDebug
)

echo "Launching app on device..."
adb -s "$DEVICE_SERIAL" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "Done: development build installed and launched on $DEVICE_SERIAL."
