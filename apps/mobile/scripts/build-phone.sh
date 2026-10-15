#!/usr/bin/env bash
# Build the app in Release, signed with YOUR Apple developer team, and install it on a connected iPhone.
# A Release build carries its JavaScript inside, so the phone does not need a Metro server on your Mac.
#
#   apps/mobile/scripts/build-phone.sh [--prebuild] [--no-install]
#
# Needs (see docs/mobile-app/iphone-test-checklist.md for the one-time setup):
#   - a Mac with Xcode, signed in to your Apple ID (Xcode > Settings > Accounts); a free account works, and the
#     app then stops working after 7 days
#   - an iPhone with Developer Mode on, connected by cable and unlocked (without one it builds and does not install)
#
# Settings, as environment variables:
#   DEVELOPMENT_TEAM          required. Your team's id: the 10 characters Xcode writes into
#                             ios/*.xcodeproj/project.pbxproj (DEVELOPMENT_TEAM = ...) once you pick your team under
#                             Signing & Capabilities, or the "Team ID" in your account on developer.apple.com
#   WJRH_BUNDLE_ID            required. An id nobody else uses, e.g. com.yourname.wjrh (the default org.wjrh.app
#                             is a placeholder that your team will refuse; it cannot change after a store release)
#   EXPO_PUBLIC_API_BASE      required. The API to bake in: an https address, or http://<Mac's address>:8797 for a
#                             local API (only on a network you trust, docs/mobile-app/status.md)
#   EXPO_PUBLIC_DEMO_ARCHIVES set to 1 for the Archive demo (docs/mobile-app/archive-demo.md)
#   PHONE_UDID                optional. Which phone; by default the first connected physical iPhone
#   APP_VARIANT               optional. Default "development" (also allows plain HTTP to a local API); use "preview"
#                             if the API is https
#
# --prebuild regenerates apps/mobile/ios (needed once, and after changing any setting above that goes into the project:
# the bundle id and APP_VARIANT). EXPO_PUBLIC_* values are read every build and need no prebuild.
set -euo pipefail

PREBUILD=0
INSTALL=1
for arg in "$@"; do
  case "$arg" in
    --prebuild) PREBUILD=1 ;;
    --no-install) INSTALL=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

missing=0
for name in DEVELOPMENT_TEAM WJRH_BUNDLE_ID EXPO_PUBLIC_API_BASE; do
  if [[ -z "${!name:-}" ]]; then echo "missing setting: $name (see the top of this file)" >&2; missing=1; fi
done
[[ $missing == 0 ]] || exit 2

export APP_VARIANT="${APP_VARIANT:-development}"
export WJRH_BUNDLE_ID EXPO_PUBLIC_API_BASE
cd "$(dirname "$0")/.."

if [[ $PREBUILD == 1 || ! -d ios ]]; then
  npx expo prebuild --clean --platform ios --no-install
  (cd ios && pod install)
fi

# The app only schedules local reminders and never uses push, but Expo's notifications plugin asks for the Push
# Notifications capability, which a free (personal) team cannot have, so signing fails. Drop it from the generated
# (git-ignored) project.
for f in ios/*/*.entitlements; do
  cat > "$f" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict/>
</plist>
EOF
done

# A connected physical iPhone, as Apple's tooling reports it.
if [[ -z "${PHONE_UDID:-}" ]]; then
  devices_json="$(mktemp)"
  xcrun devicectl list devices --json-output "$devices_json" >/dev/null 2>&1 || true
  PHONE_UDID="$(python3 - "$devices_json" <<'EOF'
import json, sys
try:
    devices = json.load(open(sys.argv[1]))["result"]["devices"]
except Exception:
    devices = []
for d in devices:
    hw, conn = d.get("hardwareProperties", {}), d.get("connectionProperties", {})
    if hw.get("reality") == "physical" and hw.get("platform") == "iOS" and conn.get("tunnelState") == "connected":
        print(hw.get("udid", ""))
        break
EOF
)"
  rm -f "$devices_json"
fi

if [[ -n "$PHONE_UDID" ]]; then
  destination="id=$PHONE_UDID"
else
  echo "No connected iPhone found: building for 'any iPhone' without installing. Plug it in, unlock it, and run again."
  destination="generic/platform=iOS"
  INSTALL=0
fi

workspace="$(ls -d ios/*.xcworkspace | head -1)"
scheme="$(basename "$workspace" .xcworkspace)"
echo "Building $scheme for $destination (team $DEVELOPMENT_TEAM, bundle id $WJRH_BUNDLE_ID, API $EXPO_PUBLIC_API_BASE)"
(cd ios && xcodebuild -workspace "$(basename "$workspace")" -scheme "$scheme" -configuration Release \
  -destination "$destination" -derivedDataPath build -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" build)

if [[ $INSTALL == 1 ]]; then
  app="$(ls -d ios/build/Build/Products/Release-iphoneos/*.app | head -1)"
  xcrun devicectl device install app --device "$PHONE_UDID" "$app"
  echo "Installed. Open it from the home screen (first time: Settings > General > VPN & Device Management > Trust)."
fi
