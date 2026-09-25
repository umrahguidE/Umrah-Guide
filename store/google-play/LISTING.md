# Google Play: everything to copy into Play Console

Everything Play Console asks for is in this folder. Copy each block into the field
with the same name.

| File | Play Console field | Size |
|---|---|---|
| `icon-512.png` | Store listing → App icon | 512 × 512 PNG |
| `feature-graphic-1024x500.png` | Store listing → Feature graphic | 1024 × 500 PNG |
| `screenshots/01…08-*.png` | Store listing → Phone screenshots (upload all 8, in order) | 1080 × 1920 PNG |
| `guided-umrah-<version>.aab` from a **version release** | Testing → Internal testing → Create release | — |

> The screenshots show the yellow "Draft guidance — not yet scholar-reviewed"
> strip because the content is not signed off yet. Retake them after sign-off,
> before the production release.

---

## 1. Developer account signup (play.google.com/console/signup)

| Field | Answer |
|---|---|
| Account type | Yourself (personal) |
| Developer name (public) | Guided Umrah |
| Legal name and address | Your own, exactly as on your ID |
| Contact email | umrahguideapp@gmail.com |
| Contact phone | Your mobile number (it is verified by SMS) |
| Website | https://umrahguide.github.io/Umrah-Guide/ |
| Apps you plan to publish | 1, free, no ads, no in-app purchases |
| Fee | US$25, once |
| Identity check | Photo of passport or national ID |

## 2. Create app

| Field | Answer |
|---|---|
| App name | Guided Umrah: Step-by-Step |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | Free |

## 3. Store listing

**App name** (max 30):

```
Guided Umrah: Step-by-Step
```

**Short description** (max 80):

```
Umrah step by step: counts Tawaf and Sa'i, duas and a map. Works offline.
```

**Full description** (max 4000):

```
Guided Umrah walks with you through your Umrah, one step at a time, from preparation to completion. At every moment it shows where you are, what to do now, which round you are on and what comes next.

STEP BY STEP
Preparation → Miqat → Ihram and intention → Talbiyah → Masjid al-Haram → Tawaf (7 rounds) → two rak'ahs → Zamzam → Sa'i (7 laps) → hair → Umrah complete.
Each step explains what to do, with separate guidance for men and women where it differs.

COUNTS TAWAF AND SA'I WITH YOU
• Big round and lap counter, so you never lose count in the crowd.
• Sa'i shows your direction on every lap: Safa → Marwah or Marwah → Safa.
• Optional location help: GPS, compass and step sensor suggest when a round or lap may be finished. The app never counts on its own — you always confirm.
• "Wrong count?" lets you correct the count at any time, and "Undo" takes back the last step.

DUAS AND RECITATIONS
• Duas and dhikr for each place, in Arabic with meaning and source.
• Arabic is played from real recorded recitations, never a computer voice.
• Save your own personal duas to remember at the Kaaba.

WORKS WITHOUT INTERNET
• Everything, including the map of Masjid al-Haram and the recitations, is inside the app.
• Your progress is saved after every step, even if the phone restarts.

MORE
• Miqat reminder for your route.
• Journey log: every round and lap with its time, to review or share.
• My info and emergency: hotel, group leader and emergency contacts, plus Saudi emergency numbers.
• Voice guide that tells you the next step in your language (where your phone's voice supports it).
• 8 languages: English, Hindi, Urdu, Bengali, Indonesian, Turkish, Tamil and Malayalam.
• Light and dark mode, adjustable text size.

PRIVATE BY DESIGN
No account, no ads, no analytics. Your progress and notes stay on your phone.

Guided Umrah is a helper, not a replacement for learning your Umrah from a scholar. When in doubt, ask a scholar.
```

**App category:** Lifestyle  ·  **Tags:** Religion, Travel guide
**Contact email:** umrahguideapp@gmail.com
**Website:** https://umrahguide.github.io/Umrah-Guide/

## 4. Policy → App content

| Section | Answer |
|---|---|
| Privacy policy | https://umrahguide.github.io/Umrah-Guide/privacy.html |
| App access | All functionality is available without special access (no login) |
| Ads | No, my app does not contain ads |
| Content rating | Category **Reference, news, or educational**. Answer **No** to violence, sexuality, bad language, drugs, gambling, user interaction, sharing location with other users, and purchases. Expected result: Everyone / PEGI 3 |
| Target audience | 13–15, 16–17, 18 and over (not under 13, so the Families policy does not apply). Appeals to children: No |
| News app | No |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health | My app doesn't have any health features |
| Advertising ID | No, the app does not use an advertising ID |

### Data safety

The app itself sends nothing to a server. The only exception is the optional real
map, shown when you turn on location **far from Masjid al-Haram**: it downloads
map tiles from OpenStreetMap, and the tile requests reveal roughly which area you
are in. So declare it, to be safe:

| Question | Answer |
|---|---|
| Does your app collect or share any required user data types? | Yes |
| Is all data encrypted in transit? | Yes (map tiles use HTTPS) |
| Can users request that data is deleted? | Yes. Everything is on the device: "End current Umrah session", clear app storage, or uninstall |
| Data types | **Location → Approximate location** only |
| Approximate location: collected / shared | Collected: Yes · Shared: No |
| Processed ephemerally? | Yes |
| Required or optional? | Optional (users can turn location help off) |
| Why collected | App functionality |

Precise location, contacts, personal info, messages, files, app activity, device
IDs: **not collected**. They are either not used or stay only on the device.

## 5. First release: Internal testing

1. Testing → Internal testing → **Create new release**.
2. App signing: **Use Google-generated key** (Play App Signing). Our keystore is the *upload* key.
3. Upload the `.aab`:
   - **Signed with the real key:** download it from a version release (tag `v…`) of `umrahguidE/Umrah-Guide`. This only works after the three `ANDROID_KEYSTORE_*` secrets are added to that repo.
   - **Don't use** the `latest` pre-release `.aab` of the new repo, because it is built with a test key until those secrets exist.
   - The `guided-umrah-0.1.0.aab` in your Downloads folder was built by the old repo with the real key, so it is fine for the first upload.
4. Release name `0.1.0`. Release notes:

```
<en-US>
First test version of Guided Umrah.
</en-US>
```

5. Testers tab: create a list, add your own Gmail, and save. Open the **opt-in link** on your phone and install from Play.

## 6. To reach Production

- New personal accounts must run a **closed test with at least 12 testers for 14 days in a row** before Production can be requested.
- **Scholar sign-off** of `docs/CONTENT_REVIEW.md` first. The draft strip then disappears; retake the screenshots.
- Then: Production → Create release → the same `.aab` → Send for review.
