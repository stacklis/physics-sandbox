# Physics Sandbox — Android wrapper

Capacitor 6 wrapper that ships the static web app as a Google Play Android build. The web app is the source of truth — this directory just hosts the Capacitor config and the Android Studio project; `sync.mjs` copies the latest web bundle into `www/`.

## Prerequisites

- **Java JDK 17+** — required by current Android Gradle Plugin.
- **Android SDK + platform-tools** — install via Android Studio's SDK Manager (Android API 34 + build-tools 34.0.0 cover the current target).
- **Gradle wrapper** — already vendored in `android/gradlew` / `gradlew.bat`. No global Gradle install needed.
- **Node 18+** for the Capacitor CLI and the `sync.mjs` script.

Verify the environment:

```bash
java -version          # should be 17.x or newer
adb devices            # platform-tools on PATH
node --version         # 18+
```

## One-time setup

```bash
cd android-app
npm install
```

Installs the Capacitor CLI and the Android runtime modules.

## Daily dev flow

```bash
npm run sync           # copies root web app into www/ and runs `cap sync android`
npx cap open android   # opens the project in Android Studio
```

From Android Studio, hit **Run** with an attached device or emulator. The app loads the local `www/` bundle, no network required.

## How sync works

`sync.mjs` mirrors the served files (`app/`, `app.js`, `app3d.js`, `engine.js`, `engine3d.js`, `education.js`, `education3d.js`, `layout.js`, `render3d.js`, `styles.css`, `manifest.json`, icons, and `privacy.html` / `terms.html`) into `android-app/www/`. Then `cap sync android` propagates the result into the native project. Edit web files in the repo root, never directly in `android-app/www/` — your changes will be overwritten on the next sync.

## Release build

1. **Bump versions** in `android/app/build.gradle`:
   - `versionCode` — integer, must increment for every Play Store upload.
   - `versionName` — human string, e.g. `"1.0.1"`. Keep it in lockstep with the root `CHANGELOG.md`.
2. **Keystore** — store the release keystore outside the repo (e.g. `~/.android/physics-sandbox-release.jks`). Never commit it.
3. **Signing config** — `android/app/build.gradle` should reference the keystore via env vars or a `~/.gradle/gradle.properties` entry (`PHYSICS_SANDBOX_STORE_FILE`, `..._STORE_PASSWORD`, `..._KEY_ALIAS`, `..._KEY_PASSWORD`). Don't hard-code paths or passwords.
4. **Build the AAB** — in Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**. Pick the release keystore, the `release` build variant, and let it produce `android/app/build/outputs/bundle/release/app-release.aab`.

CLI alternative:

```bash
cd android-app/android
./gradlew bundleRelease
```

## Play Store upload checklist

- [ ] `versionCode` incremented since last upload.
- [ ] `versionName` matches the CHANGELOG entry.
- [ ] AAB signed with the production keystore (not the debug key).
- [ ] Release notes drafted — paste the matching CHANGELOG section into the Play Console release notes field.
- [ ] Screenshots refreshed in `marketing/screenshots/` if any UI changed.
- [ ] Privacy policy URL still points at `https://physics.stacklis.com/privacy.html`.
- [ ] In Play Console: upload the AAB to the chosen track (Internal → Closed → Open → Production), fill out release notes, save, then **Review release** → **Start rollout**.

## Troubleshooting

- **Gradle fails to download Java 17 toolchain** — install JDK 17 manually and set `org.gradle.java.home` in `~/.gradle/gradle.properties` or `JAVA_HOME`.
- **`cap sync` complains about missing platform** — run `npx cap add android` once, then re-run sync.
- **WebView shows a white screen on launch** — verify `www/index.html` exists after sync, and check `capacitor.config.json`'s `webDir` matches.
