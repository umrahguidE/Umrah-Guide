# Audio

The app plays `audio/talbiyah.mp3` on the Talbiyah screen (with a repeat /
background mode). No recording ships with this build.

To add one:

1. Use a recording you have the rights to distribute, recited by someone whose
   recitation has been approved by your content reviewers.
2. Save it as `audio/talbiyah.mp3` (mono, 64–96 kbps is plenty and keeps the
   offline pack small).
3. It is already listed as an optional file in `asset-manifest.json`, so the
   offline pack will pick it up. Bump `CACHE` in `sw.js` so existing installs
   refresh.

Until the file exists, the app tells the pilgrim that audio isn't bundled and
to recite from the text.
