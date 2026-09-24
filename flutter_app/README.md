# Guided Umrah — Flutter app (Android + iOS)

This is the app that goes to **Google Play** and the **Apple App Store**. One
Dart codebase builds both. The web version at the repository root is kept as
the source of the religious content and translations, and as a browser
version of the app.

## Layout

```
flutter_app/
├── lib/
│   ├── main.dart            start-up: load content, storage, controller → AppShell
│   ├── engine/              pure Dart ritual rules — no Flutter, fully unit-tested
│   │   ├── stages.dart      stage list, Sa'i directions, progress
│   │   ├── machine.dart     the ritual state machine (transition, toRecords)
│   │   ├── tracking.dart    position filter, Tawaf/Sa'i trackers, Kaaba sectors
│   │   ├── motion.dart      step detection, heading, step-length calibration
│   │   ├── miqat.dart       route-aware Miqat check
│   │   └── geo.dart         geometry
│   ├── app/                 app logic, no widgets
│   │   ├── app_controller.dart   every action a screen can take (ChangeNotifier)
│   │   ├── content.dart     reads assets/data/content.json
│   │   ├── i18n.dart        translations (assets/i18n/<lang>.json)
│   │   ├── store.dart       saves progress on the device after every step
│   │   └── voice_lines.dart what the voice guide says at each step
│   ├── services/            phone features
│   │   ├── tracking_runtime.dart GPS, compass and step sensor → trackers
│   │   ├── location.dart    permission and one-off fixes
│   │   ├── voice.dart       voice guide (phone text-to-speech, never Arabic)
│   │   └── clips.dart       real recitations (Arabic is only ever a recording)
│   └── ui/
│       ├── shell.dart       top bar, review banner, bottom tabs, dialogs
│       ├── theme.dart       colours (light + dark) and theme
│       ├── screens/         one file per tab / page
│       ├── widgets/         cards, buttons, dua card, map, tracking cards
│       └── painters/        Tawaf ring, Sa'i track, Masjid al-Haram map
├── assets/
│   ├── data/content.json    exported from ../src/data — never edit by hand
│   ├── i18n/*.json          exported from ../src/i18n — never edit by hand
│   ├── audio/               recitations, copied at build time (not committed)
│   └── icon/                app icon sources
├── test/                    engine tests (same cases as the web app's tests)
├── android/                 Android project — package com.guidedumrah.app
└── ios/                     iOS project — bundle id com.guidedumrah.app
```

## Everyday commands

Needs the Flutter SDK (3.47 or newer) and Node 20+.

```bash
# from the repository root: refresh content, translations and recitations
npm run audio:fetch          # downloads the recitations into audio/ (once)
npm run flutter:data         # exports content + translations, copies the audio

cd flutter_app
flutter pub get
flutter analyze
flutter test
flutter run                          # on a connected phone or emulator
flutter run -d chrome --dart-define=SIM=true   # simulated GPS walks Tawaf and Sa'i for you
```

Change religious text or translations in `../src/data` and `../src/i18n`, then
run `npm run flutter:data`. The **Checks** workflow fails if the two apps ever
disagree.

## Builds in the cloud (no Android Studio or Mac needed)

| Workflow | When | Produces |
|---|---|---|
| `checks.yml` | every push / pull request | web tests, `flutter analyze`, `flutter test`, content in sync |
| `flutter-android.yml` | push to `main` | test `.apk` + `.aab` on the **latest** pre-release |
| `flutter-android.yml` | tag `v1.2.3` | signed `.aab` (Google Play) + `.apk` on release `v1.2.3` |
| `flutter-ios.yml` | tag `v1.2.3` or by hand | unsigned iOS build (proves it compiles) |
| `pages.yml` | push to `main` | the web version and `privacy.html` on GitHub Pages |

To release: raise `version:` in `pubspec.yaml` (for example `1.0.1+1` — the
build number after `+` is replaced automatically), commit, then

```bash
git tag v1.0.1 && git push origin v1.0.1
```

See [../docs/MOBILE.md](../docs/MOBILE.md) for the store steps.
