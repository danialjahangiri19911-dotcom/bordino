#!/usr/bin/env bash
# Builds the signed release APK in a JDK 21 container (no Android Studio needed).
# The app only wraps https://lottery.bordino.co/pwa, so it needs rebuilding only when this
# folder changes (icon, splash, name, version), never for website changes.
set -euo pipefail
cd "$(dirname "$0")"
KEYDIR=${KEYDIR:-/opt/projects/bordino-lottery-dev/android-keystore}
[ -f "$KEYDIR/keystore.properties" ] || { echo "No signing key in $KEYDIR (see README)" >&2; exit 1; }
docker run --rm -v "$PWD":/app -w /app node:22 sh -c 'npm ci --no-audit --no-fund >/dev/null && npx cap sync android'
docker run --rm \
  -v "$PWD":/app -w /app/android \
  -v lottery-android-sdk:/sdk -v lottery-android-gradle:/root/.gradle \
  -v "$KEYDIR":/keystore:ro \
  -e ANDROID_HOME=/sdk -e BORDINO_KEYSTORE_PROPS=/keystore/keystore.properties -e BORDINO_PUSHE_PROPS=/keystore/pushe.properties \
  eclipse-temurin:21.0.12_8-jdk-noble \
  sh -c './gradlew --no-daemon -q assembleRelease'
# The APK must carry the release signature (the one every installed copy was signed with).
# (Output captured first: `| grep -q` would end the pipe early and pipefail would call that a failure.)
certs=$(docker run --rm -v "$PWD":/app -v lottery-android-sdk:/sdk eclipse-temurin:21.0.12_8-jdk-noble \
  /sdk/build-tools/35.0.0/apksigner verify --print-certs /app/android/app/build/outputs/apk/release/app-release.apk)
grep -q "25ae4f7e58bfd1dec1a9943a1095af365075c7b623dc138c0d75d877645f47e6" <<<"$certs" \
  || { echo "APK is not signed with the Bordino release key" >&2; exit 1; }
ls -l android/app/build/outputs/apk/release/
