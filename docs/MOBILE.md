# Releasing on Google Play and the App Store

The store app is the Flutter app in [`flutter_app/`](../flutter_app/README.md).
It builds for Android and iOS from one codebase, entirely on GitHub Actions —
no Android Studio and no Mac are needed on your computer.

```
   src/data + src/i18n  (content and translations, reviewed once)
            │  npm run flutter:data
            ▼
       flutter_app/  ──►  flutter-android.yml  ──►  .aab → Google Play
                     └─►  flutter-ios.yml      ──►  .ipa → App Store (needs Apple account)
```

| | Android | iOS |
|---|---|---|
| App id | `com.guidedumrah.app` | `com.guidedumrah.app` |
| Account | Google Play Console (one-off US$25) | Apple Developer Program (US$99 / year) |
| Built on | GitHub `ubuntu-latest` | GitHub `macos-latest` |
| Minimum OS | Android 7.0 (API 24) | iOS 15 |
| Target | Android 16 (API 36) — required by Play since 31 Aug 2026 | latest Xcode SDK |

## Before any public release

- [ ] Scholar sign-off of `docs/CONTENT_REVIEW.md` (the app shows "Draft guidance" until then).
- [ ] Verify the emergency numbers and survey `HARAM_GEO` on site.
- [ ] A person listens to every recitation to confirm it matches its dua.

## Google Play

1. **Repository secrets** (Settings → Secrets and variables → Actions):
   `ANDROID_KEYSTORE_BASE64` (the upload keystore, base64), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`. Keep the keystore and its password backed up somewhere
   safe — Play only accepts updates signed with the same upload key.
2. **Build**: raise `version:` in `flutter_app/pubspec.yaml`, commit, push a tag
   `v1.0.0`. The release `v1.0.0` gets `guided-umrah-1.0.0.aab` and `.apk`.
3. **Play Console**: create the app (default language, "App", "Free"), upload the
   `.aab` to **Testing → Internal testing** first, then Closed testing.
   New personal developer accounts must run a closed test with at least 12
   testers for 14 days before Production is unlocked.
4. **Store listing**: 512×512 icon, 1024×500 feature graphic, at least two phone
   screenshots, short and full description, and the privacy policy URL
   `https://umrahguide.github.io/Umrah-Guide/privacy.html`.
5. **App content → Data safety**: location is collected *on the device only* and
   not shared; no account, no analytics. The one network call is the optional
   real map (OpenStreetMap tiles) when far from Masjid al-Haram.

The `.apk` on each release installs directly on a phone for testing. An `.aab`
cannot be installed directly — it is only for Google Play.

## App Store

Blocked until there is an Apple Developer account. Once enrolled:

1. Note the **Team ID** (developer.apple.com → Membership details).
2. In App Store Connect, create the app with bundle id `com.guidedumrah.app`.
3. Create an **App Store Connect API key** (Users and Access → Integrations) and
   add as secrets: `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_PRIVATE_KEY`,
   plus `APPLE_TEAM_ID`.
4. Extend `flutter-ios.yml` to sign with those (automatic signing via the API key),
   run `flutter build ipa`, and upload the `.ipa` to TestFlight.
5. Test through TestFlight, then submit for review with the same privacy URL.

Until then, `flutter-ios.yml` builds an **unsigned** `.ipa` on every push to
`main` and every version tag, and attaches it to the same release as the `.apk`.
It proves the app compiles for iPhone. It cannot go to the App Store, but it
can be put on your own iPhone with AltStore or Sideloadly, which re-sign it
with a free Apple ID. That signature lasts 7 days.

## The web version

The root of the repository is also a complete web app (PWA), published by
`pages.yml` to GitHub Pages together with `privacy.html`. It is the same app
in a browser, and the source of the content that the Flutter app exports.
