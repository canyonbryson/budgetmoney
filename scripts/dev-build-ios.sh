#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_PATH="$ROOT_DIR/build-ios-simulator.tar.gz"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if ! command -v eas >/dev/null 2>&1; then
  echo "Error: eas-cli is not installed or not in PATH."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Error: xcrun is not installed. Install Xcode command line tools."
  exit 1
fi

echo "Building iOS development client for simulator..."
(
  cd "$ROOT_DIR"
  eas build --platform ios --profile simulator --local --output "$ARTIFACT_PATH"
)

if [[ ! -f "$ARTIFACT_PATH" ]]; then
  echo "Error: expected build artifact not found at $ARTIFACT_PATH"
  exit 1
fi

echo "Extracting app bundle..."
tar -xzf "$ARTIFACT_PATH" -C "$TEMP_DIR"

APP_PATH="$(python3 - "$TEMP_DIR" <<'PY'
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
apps = sorted([p for p in root.rglob("*.app") if p.is_dir()])
print(apps[0] if apps else "")
PY
)"

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Error: could not find .app bundle in $ARTIFACT_PATH"
  exit 1
fi

BUNDLE_ID="$(
  cd "$ROOT_DIR"
  node -e "const app=require('./app.json'); console.log(app?.expo?.ios?.bundleIdentifier || '');" 2>/dev/null || true
)"

BOOTED_UDID="$(xcrun simctl list devices | awk -F '[()]' '/Booted/{print $2; exit}')"
TARGET_UDID="$BOOTED_UDID"

if [[ -z "$TARGET_UDID" ]]; then
  TARGET_UDID="$(xcrun simctl list devices available | awk -F '[()]' '/iPhone/ && /Shutdown/{print $2; exit}')"
fi

if [[ -z "$TARGET_UDID" ]]; then
  echo "Error: no available iOS simulator found."
  exit 1
fi

echo "Preparing simulator: $TARGET_UDID"
open -a Simulator >/dev/null 2>&1 || true
xcrun simctl boot "$TARGET_UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$TARGET_UDID" -b

echo "Installing app bundle..."
xcrun simctl install "$TARGET_UDID" "$APP_PATH"

if [[ -n "$BUNDLE_ID" ]]; then
  echo "Launching app..."
  xcrun simctl launch "$TARGET_UDID" "$BUNDLE_ID" >/dev/null || true
fi

echo "Done: Expo development build installed on iOS simulator."
