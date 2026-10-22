# AccessFlow — Fire TV (Fire OS) WebView Wrapper

A minimal native Android wrapper that runs the AccessFlow web app on
Fire TV / Android TV. One full-screen `WebView` loads the app bundled in
assets (`file:///android_asset/index.html`) — no network needed, the exact
same HTML/CSS/JS as the web demo in `~/workspace/accessflow-repo/`.

- **Package:** `com.arya.accessflow` · versionCode 1 · versionName 1.0
- **compileSdk / targetSdk:** 34 · **minSdk:** 24
- **Activity:** `com.arya.accessflow.MainActivity` (landscape, `LAUNCHER` +
  `LEANBACK_LAUNCHER`, so it appears on the Fire TV home row)
- **Remote input:** the WebView is focusable and focused on launch, so
  D-pad presses arrive in the page as DOM key events (arrows, Enter).
  The remote **Back** button is translated into an **Escape** key event for
  the page instead of exiting, matching the app's keyboard handler
  (Escape/Backspace = back). Screen is kept on while in the foreground.
- **Artwork:** `ic_launcher.png` / `banner.png` are simple generated
  gradient placeholders — replace with real branding before any store
  submission.

## APK

Built and verified on this VM (Oct 22, 2026):

- `accessflow-debug.apk` (project root, copy) and
  `app/build/outputs/apk/debug/app-debug.apk`
- 41,787 bytes, SHA-256
  `351d272ac865e423beb34fbcfd530d25e9becfc503339e9df9711e9a871b9da9`
- Signed with the standard Android debug key; `apksigner verify` passes
  (v2 + v3 schemes). Contains `assets/index.html`, `assets/css/styles.css`,
  `assets/js/engine.js`, `assets/js/app.js` (byte-identical to the web app).
- Install on a Fire TV / Android TV / emulator with:
  `adb install -r accessflow-debug.apk`
- **Not yet tested on a physical Fire TV device** — verification so far is
  structural (aapt badging, apkanalyzer, dex inspection, signature).

## How it was built here (and how to rebuild normally)

Toolchain installed under `~/workspace/` for this build (the VM had no
Java/Android tooling):

- Temurin JDK **17.0.13** (`~/workspace/jdk-17`) — apt was stalled, so the
  official tarball was used. AGP 8.5.x requires JDK 17.
- Android SDK (`~/workspace/android-sdk`): command-line tools 12.0,
  platform-tools r37.0.1, `platforms;android-34` (ext12),
  `build-tools;34.0.0`. Packages were fetched as the official
  `dl.google.com` archives with curl and unpacked into the standard SDK
  layout (with hand-written `package.xml` + license files), because
  `sdkmanager`'s Java HTTPS tunneling crashes against this sandbox's
  authenticated egress proxy (`NoSuchElementException` in
  `HttpURLConnection.doTunneling0`).
- Gradle **8.7** distribution (`~/workspace/gradle-8.7`), AGP **8.5.2**.

**Sandbox caveat — why the APK was not produced by `./gradlew`:**
this VM's permission policy denies direct TCP (`other_tcp` = Deny), and
that includes loopback sockets between JVM processes. The Gradle daemon
(client ↔ daemon communicate over a 127.0.0.1 socket) therefore can never
handshake here — every `gradle` invocation fails with
"Could not receive a message from the daemon", with or without
`--no-daemon` (proven with a minimal Java socket test, which received the
policy's denial message instead of its own payload). Enabling it would
require the user to set Muse settings → Permissions → Direct network
protocols → `other_tcp` to Ask/Allow.

Because of that, the APK above was produced with the **equivalent manual
build-tools pipeline** — the same steps AGP runs internally:

```
aapt2 compile --dir app/src/main/res -o compiled-res.zip
aapt2 link -o app-unsigned.apk -I platforms/android-34/android.jar \
    --manifest <manifest with package= injected, as AGP does> \
    -A app/src/main/assets --java gen \
    --min-sdk-version 24 --target-sdk-version 34 \
    --version-code 1 --version-name 1.0 compiled-res.zip
javac -cp android.jar -d classes <MainActivity.java + generated R.java>
d8 --lib android.jar --min-api 24 --output dex classes/...
zip classes.dex into the APK; zipalign -p 4; apksigner sign (debug key)
```

Intermediate outputs are kept under `app/build-manual/` for inspection.

On any normal machine the Gradle build in this repo works as-is:

```
gradle wrapper --gradle-version 8.7   # generates gradlew + wrapper jar
./gradlew assembleDebug               # -> app/build/outputs/apk/debug/app-debug.apk
```

(`gradle/wrapper/gradle-wrapper.properties` is included; `gradlew` and
`gradle-wrapper.jar` could not be generated in this sandbox for the
daemon reason above.)

## Layout

```
settings.gradle, build.gradle          Gradle build (AGP 8.5.2)
app/build.gradle                       namespace/SDK versions
app/src/main/AndroidManifest.xml       leanback launcher, landscape
app/src/main/java/com/arya/accessflow/MainActivity.java
app/src/main/assets/                   the web app, copied exactly
app/src/main/res/                      app name, icon, banner
```
