# Shipping one codebase to Google Play and the App Store

The app is a web app, so **Capacitor** wraps this same code as a native Android
app and a native iOS app. Nothing is rewritten: the ritual engine, screens,
voice guide and map are the files already in this repo.

```
            src/ + index.html
                    │
              node scripts/build.mjs → dist/
                    │
              npx cap sync
          ┌─────────┴─────────┐
       Android                iOS
      .aab / .apk            .ipa
   Google Play Store      Apple App Store
```

Capacitor was chosen over Flutter or React Native because those would mean
rebuilding every screen. If you later want a fully native UI, the engine
(`src/engine/`) is plain JavaScript with no DOM in it and ports as-is; only
`src/ui/` would be rewritten.

## What you need

| | Android | iOS |
|---|---|---|
| Machine | Windows, macOS or Linux | **macOS only** |
| Tools | Android Studio, JDK 17 | Xcode 15+, CocoaPods |
| Account | Google Play Developer (one-off fee) | Apple Developer Program (yearly) |

## First-time setup

```bash
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/android @capacitor/ios
npm run build          # writes dist/
npx cap add android
npx cap add ios        # on a Mac
```

`capacitor.config.json` is already in the repo (app id `com.guidedumrah.app`,
web folder `dist`). Change the id before you publish under your own account.

## Every time you change the app

```bash
npm run build && npx cap sync
npx cap open android   # build/run from Android Studio
npx cap open ios       # build/run from Xcode
```

## Permissions to declare

The counting needs location, the compass and the step sensor. In a native
shell these must be declared or the sensors stay silent.

**Android** — `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

**iOS** — `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to suggest when a Tawaf round or Sa'i lap is complete. You always confirm it yourself.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Keeps counting your rounds while the screen is off.</string>
<key>NSMotionUsageDescription</key>
<string>Counts your steps and turning so rounds keep counting where GPS is weak.</string>
<key>UIBackgroundModes</key>
<array><string>location</string><string>audio</string></array>
```

## What the native shell adds over the web version

- **Background counting**: keeps tracking with the screen off, which a web app cannot do reliably (especially on iPhone).
- **Background audio**: the Talbiyah and the voice guide keep playing when the phone is locked.
- **A real step counter**: Android `ACTIVITY_RECOGNITION` and iOS CoreMotion are more accurate than reading the accelerometer in a browser. Swap `src/ui/sensors.js` for a plugin-backed version; the engine takes a step total either way.
- **Notifications**: e.g. the Miqat alert while the phone is in a pocket on the plane.

## Before submitting to the stores

1. **The scholar review must be finished** (`docs/CONTENT_REVIEW.md`). Both stores also have rules about religious content: it must be accurate and non-offensive.
2. Remove the "Draft guidance" banner only after sign-off.
3. Replace `icon.svg` with the PNG icon sets both stores require (1024×1024 for iOS; adaptive icons for Android).
4. Write a privacy policy. Say plainly that location and motion are used on the device for counting, and that nothing is uploaded (this is true of the current build — there is no backend).
5. Add screenshots for each store. The ones in this repo's e2e run are a good starting point.
6. Test on a real phone inside a mosque or a large open space before relying on it in the Haram.
