# Audio

The app can speak everything itself with the phone's voice, but a **recorded
reciter is always preferred**: when a file below exists, it is played instead of
the speech engine, and the Listen button on that dua plays the recitation.

## Files the app looks for

| File | Dua | Source |
|---|---|---|
| `audio/talbiyah.mp3` | Talbiyah | Ṣaḥīḥ al-Bukhārī 1549; Ṣaḥīḥ Muslim 1184 |
| `audio/duas/intention.mp3` | Intention for Umrah | Based on Ṣaḥīḥ Muslim 1251 (ḥadīth of Anas); wording for Umrah alone |
| `audio/duas/ishtirat.mp3` | Condition when entering Ihram (optional) | Ṣaḥīḥ al-Bukhārī 5089; Ṣaḥīḥ Muslim 1207 (Ḍubāʿah bint az-Zubayr) |
| `audio/duas/enter-mosque.mp3` | Entering the mosque | Ṣaḥīḥ Muslim 713 |
| `audio/duas/black-stone.mp3` | At the Black Stone | Ṣaḥīḥ al-Bukhārī 1613 |
| `audio/duas/yemeni-corner.mp3` | Between the Yemeni Corner and the Black Stone | Sunan Abī Dāwūd 1892; the words are Qur’an 2:201 |
| `audio/duas/maqam.mp3` | At Maqām Ibrāhīm | Qur’an 2:125; recited by the Prophet ﷺ per Ṣaḥīḥ Muslim 1218 |
| `audio/duas/zamzam.mp3` | Drinking Zamzam | Sunan Ibn Mājah 3062 |
| `audio/duas/safa-verse.mp3` | Approaching Safa | Qur’an 2:158; Ṣaḥīḥ Muslim 1218 (ḥadīth of Jābir) |
| `audio/duas/safa-marwah-dhikr.mp3` | On Safa and on Marwah | Ṣaḥīḥ Muslim 1218 (ḥadīth of Jābir) |
| `audio/duas/green-markers.mp3` | Between the green markers | Reported from Ibn Masʿūd and Ibn ʿUmar (Muṣannaf Ibn Abī Shaybah) |
| `audio/duas/leave-mosque.mp3` | Leaving the mosque | Ṣaḥīḥ Muslim 713 |
| `audio/duas/four-words.mp3` | The four most beloved words | Ṣaḥīḥ Muslim 2137 |
| `audio/duas/istighfar.mp3` | Seeking forgiveness | Ṣaḥīḥ al-Bukhārī 6307 |
| `audio/duas/hawqala.mp3` | A treasure of Paradise | Ṣaḥīḥ al-Bukhārī 6384; Ṣaḥīḥ Muslim 2704 |
| `audio/duas/afw-afiyah.mp3` | Pardon and well-being | Sunan Abī Dāwūd 5074; Sunan Ibn Mājah 3871 |

The Talbiyah file (`audio/talbiyah.mp3`) is also used by the Talbiyah screen's
player, including its repeat / background mode.

## Adding recordings

1. Use recitations you have permission to distribute, by a reciter your content
   reviewers approve. Do not take audio from apps or sites without a licence.
2. Save each file with the exact name above. Mono MP3 at 64–96 kbps is plenty
   and keeps the offline pack small.
3. List any new files under the `audio` group in `asset-manifest.json` so they
   are stored for offline use, and bump `CACHE` in `sw.js`.
4. Reload the app and press Listen on that dua to check it.

Until a file exists, the app falls back — in this order — to the phone's Arabic
voice (if one is installed), the transliteration, then the meaning in English.
A phone voice is not a reciter: it can mispronounce, which matters most for the
Qur'anic verses. Recordings are the right answer for anything that ships.
