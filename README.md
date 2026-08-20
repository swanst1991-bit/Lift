# Lift — offline training log

A single-page web app for logging lifting, running and bodyweight on an iPhone,
with random challenges scaled to your own numbers. No accounts, no server, no
dependency on Claude or anything else.
**All data lives in the phone's own storage and never leaves the device.**

Built for an Upper/Lower split run twice a week.

> **Live at <https://swanst1991-bit.github.io/Lift/>** — note the **capital L**.
> GitHub Pages URLs are case-sensitive while the rest of GitHub is not, so
> `/lift/` returns a 404 that looks exactly like Pages being switched off.

---

## What the app does

| Tab | What it does |
|---|---|
| **Home** | Which session is next, this week's summary, one-tap bodyweight entry, recent activity |
| **Lift** | Start a routine or a free session; per-exercise set logging |
| **Run** | Date, distance, time, average HR — pace calculated |
| **Play** | Draw a random challenge, or pick one; run it and log the result |
| **Progress** | Bodyweight trend, per-exercise estimated 1RM, weekly running volume, PB table |

**Routines** ship as Upper A → Lower A → Upper B → Lower B on rotation, and Home
always knows which is next. All four are editable in Settings, as is the exercise
list.

### Challenges

Twelve of them, across lifting, treadmill and bodyweight. The point is that none
of them prescribe fixed numbers — every weight, speed and rep target is derived
from what is already in the log:

- **Lifting** — 5×5, one all-out set at 75%, a 1-2-3-4-5 ladder, ten-by-ten. The
  weight comes from your estimated 1RM for that lift, and the four main lifts
  rotate so the same one doesn't keep coming up.
- **Treadmill** — 1 km time trial, 4×4 Norwegian, ten 30/30s, a 30-minute incline
  grind. Speeds are prescribed in km/h from your own recent pace, clamped to what
  your machine can actually do (set its top speed and max incline in Settings).
- **Bodyweight** — 100 push-ups for time, push-ups on the minute, plank
  accumulation, dead hang. These scale off benchmarks in Settings rather than the
  training log, since push-ups and holds aren't logged as sets. A challenge that
  can't be prescribed without a benchmark runs the test on the way in.

The draw favours challenges you haven't done lately and skips anything done in the
last 48 hours. Filters narrow it by type and by how long you've got.

**Results go into the main log, not a sidecar.** A 5×5 writes a real session, so
the estimated-1RM chart and weekly tonnage include it. A time trial writes a real
run, so weekly distance is right. Challenge-specific records — fastest 1 km,
longest hang — are kept alongside in their own history.

---

## Install it on the iPhone

1. Open <https://swanst1991-bit.github.io/Lift/> in **Safari** — not Chrome. Only
   Safari can install to the home screen.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the home-screen icon from then on, not from a Safari tab.

**This step is not optional.** Safari clears the storage of ordinary websites after
about seven days of no visits. Home-screen-installed apps are exempt. Open it from
the icon and your history is safe; open it from a Safari tab and one quiet fortnight
could wipe it. The app shows a banner saying so until you dismiss it.

After the first load it works with no signal — the service worker caches everything.

**Check it worked:** log something, turn on Airplane Mode, reopen from the icon.
If it loads with your entry intact, you're done.

---

## Backups

Settings (gear icon, top right of Home) → **Export**. That hands you a JSON file via
the iOS share sheet — save it to Files, iCloud, or email it to yourself.

Do this monthly. A lost phone with no export is a lost training history; there is no
server-side copy to restore from, by design.

**Import** replaces everything on the device with the contents of a backup file.

### The pre-challenges snapshot

The challenges update moved the saved data from schema v1 to v2. Before its first
write it copied the old v1 blob to a separate storage key, and Settings → Backup
offers **Restore pre-challenges backup** while that copy exists. Restoring it
discards everything logged since the update. It is there because the upgrade
touched two months of history that has no other copy.

---

## Changing it later

Edit `index.html`, then:

1. **Bump the cache version** in `sw.js` — it is currently `lift-v4`. Skip this and
   phones may keep serving the old cached copy indefinitely.
2. Commit and push both changed files.
3. Open the app on the phone twice: once to fetch the new version in the background,
   once to run it.

### Tests

The test suite runs under the JavaScriptCore shell that ships with macOS, because
there is no `node` on the machine this was built on:

```sh
dev/run-tests.sh      # prints the assertion count; exits non-zero on failure
```

It covers the date arithmetic (including both British Summer Time boundaries, which
caught a real bug), the Epley maths and its inverse, weekly aggregation, PB
detection, the session lifecycle, the challenge engine's calibration, the v1→v2
migration against null, empty and partial blobs, and that every view and every
challenge runner renders without throwing.

To eyeball the layout at iPhone size (402×874, iPhone 17):

```sh
dev/shot.py --list            # the view names
dev/shot.py play settings     # writes dev/shots/*.png with demo data
dev/shot.py --empty home      # as a fresh install sees it
```

`shot.py` renders the app inside a 402px iframe rather than sizing the window,
because macOS clamps Chrome's minimum window width to 500px. Without the iframe
the page lays out at 500px and the capture crops the right-hand edge, which looks
exactly like a layout bug in the app and is not one.

`dev/` is not required to run or deploy the app.

---

## Known limitations

- Tested in Chrome at an iPhone viewport, **not on a real iPhone**. Safari-specific
  behaviour — the share-sheet export, date input styling, home-screen install, and
  the interval timer's audio cues — is written to spec but unconfirmed.
- The challenge timer's beeps use WebAudio unlocked by the Start tap, which is the
  correct pattern for iOS but has not been confirmed on device.
- Treadmill limits default to a **NordicTrack T 6.5 S**: 16 km/h top speed and
  0–10% incline, with the console reading km/h. If you ever run this on a different
  machine, change both in Settings — a prescription above what the belt can do is
  worthless. Note the 10% ceiling means the usual "12-3-30" walk isn't possible on
  this treadmill; the incline challenge asks for 10% instead.
- No rest timer, supersets, RPE, or warm-up/working set distinction.
- No Strava or Apple Health import. Runs are entered by hand.
