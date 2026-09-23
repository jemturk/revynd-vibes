#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

usage() {
  echo "Usage: $0 (-apk|-aab) [-i]" >&2
  echo "  -apk  build the release APK and install it" >&2
  echo "  -aab  build the release AAB" >&2
  echo "  -i    skip building — just install the APK already built in this dir (requires -apk)" >&2
  exit 1
}

MODE=""
INSTALL_ONLY=false

for arg in "$@"; do
  case "$arg" in
    -apk) [[ -n "$MODE" && "$MODE" != "apk" ]] && usage; MODE="apk" ;;
    -aab) [[ -n "$MODE" && "$MODE" != "aab" ]] && usage; MODE="aab" ;;
    -i) INSTALL_ONLY=true ;;
    *) usage ;;
  esac
done

[[ -z "$MODE" ]] && usage
if [[ "$MODE" == "aab" && "$INSTALL_ONLY" == true ]]; then
  echo "Error: -i isn't supported with -aab — an .aab can't be installed directly via adb." >&2
  exit 1
fi

if [[ -z "${MAPBOX_PUBLIC_TOKEN:-}" && ! -f "$PROJECT_ROOT/.env" ]]; then
  echo "Error: MAPBOX_PUBLIC_TOKEN is not configured." >&2
  echo "Create $PROJECT_ROOT/.env with MAPBOX_PUBLIC_TOKEN=pk.your_token, then rerun this command." >&2
  exit 1
fi

if [[ ! -d "$PROJECT_ROOT/android" || ! -f "$PROJECT_ROOT/android/app/src/main/res/values/mapbox_strings.xml" ]]; then
  if [[ "$INSTALL_ONLY" == true ]]; then
    echo "Error: Android project not found. Run without -i to generate and build it first." >&2
    exit 1
  fi

  echo "Android project not found; generating it with Expo prebuild..."
  (cd "$PROJECT_ROOT" && npx expo prebuild --platform android)
fi

cd "$PROJECT_ROOT/android"

SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
if [[ ! -d "$SDK_DIR" ]]; then
  echo "Error: Android SDK not found at $SDK_DIR." >&2
  echo "Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK directory." >&2
  exit 1
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
printf 'sdk.dir=%s\n' "${SDK_DIR//\\/\\\\}" > local.properties

APK_PATH="$(pwd)/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="$(pwd)/app/build/outputs/bundle/release/app-release.aab"

if [[ "$MODE" == "apk" ]]; then
  [[ "$INSTALL_ONLY" == false ]] && ./gradlew assembleRelease
  "$SDK_DIR/platform-tools/adb" install -r "$APK_PATH"
else
  ./gradlew bundleRelease
  echo "Built AAB: $AAB_PATH"
fi
