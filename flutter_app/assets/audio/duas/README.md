# Recitation audio (not committed)

The recorded Qur'an and dua recitations belong to their reciters and
publishers, so they are downloaded at build time, not stored in git:

    npm run audio:fetch          # writes ./audio/
    cp -r audio/. flutter_app/assets/audio/

`assets/audio/duas/index.json` (written by that script) lists what is
present; the app plays only what the index names and hides the rest.
This README exists so the folder is always there for `flutter build`.
