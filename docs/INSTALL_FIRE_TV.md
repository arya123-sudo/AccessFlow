# AccessFlow on Fire TV — Install Guide
AccessFlow's engine is framework-independent JavaScript. For Fire TV it ships as a native **Fire OS app** (source in [`fire-tv/`](../fire-tv/)): a single full-screen WebView activity that bundles the exact web build from this repo as assets, so the code running on the TV is byte-identical to the browser demo.

- Package: `com.arya.accessflow` · minSdk 24 · targetSdk 34 · orientation: landscape · Leanback launcher entry

## Option A — install the prebuilt APK (sideload)
1. On the Fire TV: Settings → My Fire TV → Developer options → enable **ADB debugging** and **Apps from unknown sources**.
2. Find the TV's IP (Settings → My Fire TV → About → Network).
3. From a computer on the same network:
   ```
   adb connect <tv-ip>:5555
   adb install fire-tv/accessflow-debug.apk
   ```
4. Launch **AccessFlow** from the Fire TV apps row. Navigate with the real Fire TV remote — D-pad and Select reach the app as key events; the remote Back button is mapped to the app's Back (Escape) action instead of exiting.

## Option B — build from source
1. Install Android Studio (or the Android SDK command-line tools) with platform android-34 and build-tools 34.0.0, plus JDK 17.
2. Copy the web app into the wrapper's assets (the wrapper loads `assets/index.html`):
   ```
   cp index.html fire-tv/app/src/main/assets/
   cp -r css js fire-tv/app/src/main/assets/
   ```
3. Build:
   ```
   cd fire-tv && ./gradlew assembleDebug
   # output: app/build/outputs/apk/debug/app-debug.apk
   ```
   (First run: generate the wrapper with `gradle wrapper` if `gradlew` is absent.)
4. Install with `adb install` as in Option A.

## Honest status notes
- The APK in this repo was built and verified structurally (package badging, signature, bundled assets byte-identical to the web build) during the hackathon.
- We attempted to also run it on Amazon's **Appstore Quality Central Live Device Interaction** cloud Fire TV for filmed verification; the Amazon Developer sign-in refused automated/AI-agent browser access (and persisted when the account owner drove the browser), so filmed on-device verification was not possible inside the hackathon window. This is logged in our Devpost friction log.
- Vega OS note: Amazon's newer Vega stack (React Native for Vega + Vega Virtual Device) is the strategic target; the engine's graph/discovery/prediction logic is plain JS and ports directly — the WebView shell is the pragmatic Fire OS route for this submission.
