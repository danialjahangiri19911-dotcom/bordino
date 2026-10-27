#!/usr/bin/env bash
# Builds the signed release APK in a JDK 21 container (no Android Studio needed).
# The app only wraps https://lottery.bordino.co/pwa, so it needs rebuilding only when this
# folder changes (icon, splash, name, version), never for website changes.
set -euo pipefail
cd "$(dirname "$0")"
KEYDIR=${KEYDIR:-/opt/projects/bordino-lottery-dev/android-keystore}
docker run --rm -v "$PWD":/app -w /app node:22 sh -c 'npm ci --no-audit --no-fund >/dev/null && npx cap sync android'
docker run --rm \
  -v "$PWD":/app -w /app/android \
  -v lottery-android-sdk:/sdk -v lottery-android-gradle:/root/.gradle \
  -v "$KEYDIR":/keystore:ro \
  -e ANDROID_HOME=/sdk -e BORDINO_KEYSTORE_PROPS=/keystore/keystore.properties \
  eclipse-temurin:21.0.12_8-jdk-noble \
  sh -c './gradlew --no-daemon -q assembleRelease'
ls -l android/app/build/outputs/apk/release/
