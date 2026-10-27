# Bordino Android app (Capacitor)

The app is a thin native shell around the live PWA: it opens `https://lottery.bordino.co/pwa`
(`capacitor.config.json` → `server.url`). Every change deployed to the website shows up in the
app on its next launch — **no app update is needed for website changes.**

Rebuild the APK only when something in this folder changes: name, icon, splash, start URL,
offline page (`www/offline.html`), or a native plugin. Bump `versionCode`/`versionName` in
`android/app/build.gradle` each time, or phones will refuse to install it over the old one.

## Build

```bash
./build-apk.sh        # signed release APK → android/app/build/outputs/apk/release/app-release.apk
cp android/app/build/outputs/apk/release/app-release.apk \
   ../Bordino_Frontend-develop/Bordino_Frontend-develop/public/download/bordino.apk
```

Then rebuild/deploy the frontend; the landing page links to `/download/bordino.apk`.
Needs Docker only (JDK 21 + Android SDK run in containers; SDK lives in the `lottery-android-sdk` volume).

## Signing key — back it up

`/opt/projects/bordino-lottery-dev/android-keystore/` (`bordino-release.jks` + `keystore.properties`)
is **not** in git. Every future update must be signed with this same key; if it is lost, users have
to uninstall the app before they can install a new version. Keep a copy somewhere safe off this server.

## Notes

- The app adds `BordinoApp/1` to the browser user-agent; the landing page uses it to hide the
  «بردینو روی گوشی» install section inside the app.
- Offline: the app shows `www/offline.html` and reloads by itself when the connection is back.
- iPhone: there is no iOS build (needs a Mac + Apple developer account); the landing page shows
  «Add to Home Screen» steps instead, which installs the PWA.
