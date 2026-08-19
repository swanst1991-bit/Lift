# Lift — offline training log

A single-page web app for logging lifting, running and bodyweight on an iPhone.
No accounts, no server, no dependency on Claude or anything else.
**All data lives in the phone's own storage and never leaves the device.**

Built for an Upper/Lower split run twice a week.

> **Status:** built and tested, **not yet deployed**. Everything below is written to
> be followed on your own Mac with no further help. Target account:
> <https://github.com/swanst1991-bit> — the `lift` repo does not exist yet.

---

## 0. Getting these files onto the home Mac

They currently live in Snap's OneDrive on the work Mac, at
`ClaudeWork/output/lift-tracker/`. A zip sits one level up as
`ClaudeWork/output/lift-tracker.zip`. Pick whichever works:

- **OneDrive on the web** — sign in at <https://onedrive.com> from the home Mac and
  download `ClaudeWork/output/lift-tracker.zip`. Simplest if Snap allows sign-in
  from a personal machine.
- **Email it to yourself** — attach the zip to a mail to your personal address.
  It's ~180KB. It's your own project, not company data.
- **USB stick or AirDrop** — if both Macs are to hand.

Unzip it anywhere on the home Mac. `~/Projects/lift` is a reasonable spot.

---

## 1. Publish it (one-time, ~5 minutes)

It needs an `https://` address for two reasons: iOS only allows Add-to-Home-Screen
from https, and only installed pages get durable storage. GitHub Pages is free
and permanent.

### Step 1 — create the repo

<https://github.com/new>

- **Repository name:** `lift`
- **Public** — this only exposes the *code*, which is a barbell logger. Your
  training data never goes near GitHub; it lives in your phone. It has to be
  Public because Pages won't serve private repos on a free account.
- **Leave every checkbox off** (no README, no .gitignore, no licence).
- **Create repository**

### Step 2 — upload the files

On the new repo's page: **Add file → Upload files**. Drag in these seven from the
unzipped folder:

```
index.html
sw.js
manifest.webmanifest
icon-180.png
icon-192.png
icon-512.png
icon-512-maskable.png
```

`README.md` and `dev/` are optional — they don't affect the app. Include them if
you want the documentation and tests alongside the code.

Then **Commit changes** at the bottom.

### Step 3 — switch Pages on

In the repo: **Settings** → **Pages** (left sidebar) → under "Build and deployment"
set Source to **Deploy from a branch**, Branch **main**, folder **/ (root)** → **Save**.

Wait about a minute. Your URL will be:

```
https://swanst1991-bit.github.io/lift/
```

Open it on the Mac first to confirm it works before touching the phone.

<details>
<summary>Alternative: push with git instead of the web uploader</summary>

The unzipped folder is already a git repository with one commit and the remote
already pointing at `git@github.com:swanst1991-bit/lift.git`. You just need an SSH
key on the home Mac:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N "" -C "home mac"
cat ~/.ssh/id_ed25519_github.pub | pbcopy
```

Paste that at <https://github.com/settings/ssh/new>, then:

```sh
cd ~/Projects/lift
ssh -T git@github.com     # expect: "Hi swanst1991-bit! You've successfully authenticated"
git push -u origin main
```

Still do Step 1 (create the empty repo) and Step 3 (enable Pages) in the browser.
</details>

---

## 2. Install it on the iPhone

1. Open `https://swanst1991-bit.github.io/lift/` in **Safari** — not Chrome. Only
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

## 3. Backups

Settings (gear icon, top right of Home) → **Export**. That hands you a JSON file via
the iOS share sheet — save it to Files, iCloud, or email it to yourself.

Do this monthly. A lost phone with no export is a lost training history; there is no
server-side copy to restore from, by design.

**Import** replaces everything on the device with the contents of a backup file.

---

## 4. Changing it later

Edit `index.html`, then:

1. **Bump the cache version** in `sw.js` — change `lift-v1` to `lift-v2`, and so on.
   Skip this and phones may keep serving the old cached copy indefinitely.
2. Upload both changed files to the repo (or `git push`).
3. Open the app on the phone twice: once to fetch the new version in the background,
   once to run it.

---

## What the app does

| Tab | What it does |
|---|---|
| **Home** | Which session is next, this week's summary, one-tap bodyweight entry, recent activity |
| **Lift** | Start a routine or a free session; per-exercise set logging |
| **Run** | Date, distance, time, average HR — pace calculated |
| **Progress** | Bodyweight trend, per-exercise estimated 1RM, weekly running volume, PB table |

**Routines** ship as Upper A → Lower A → Upper B → Lower B on rotation, and Home
always knows which is next. All four are editable in Settings, as is the exercise
library. The starting exercise list is a sensible default, not your actual
programme — change it to match what you really do.

**Logging a set** shows what you did last time for that exercise (`Last (6 days ago):
77.5×6, 77.5×6, …`) and prefills the weight from it. Tap a logged set to pull it back
into the inputs and correct it.

**Estimated 1RM** uses the Epley formula (`w × (1 + reps/30)`). A set that beats your
previous best for that exercise is starred as you log it.

**Bodyweight** is charted as a trailing 7-day average over the daily readings, so
day-to-day water weight doesn't read as progress. The weekly change on Home compares
averages, not single readings.

Units are kg and km throughout.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — markup, styles and logic, no dependencies |
| `sw.js` | Service worker; makes it work offline |
| `manifest.webmanifest` | Home-screen name, icon and standalone display |
| `icon-*.png` | App icons |
| `dev/` | Test suite and screenshot tooling — **not needed to deploy** |

Data is stored under the localStorage key `lift.v1` as a single JSON object
(`ex`, `routines`, `order`, `sessions`, `runs`, `weights`, `draft`).

## Running the tests

No npm, no install — macOS ships the JavaScriptCore shell.

```sh
cd dev
./run-tests.sh
```

68 assertions covering date arithmetic (including the March and October DST
boundaries, which caught a real bug), the Epley maths, axis tick generation,
weekly aggregation, PB detection, the session lifecycle, persistence round-trips,
and that every view renders both populated and empty.

To eyeball the layout at iPhone size (402×874, iPhone 17):

```sh
cd dev
python3 make_demo.py           # builds demo.html with 8 weeks of fake training
python3 -m http.server 8777    # then, in another shell:
python3 shot.py home           # writes view-home.png
python3 shot.py progress 560   # optional scroll offset
```

`shot.py` renders inside a 402px iframe rather than sizing the window, because
macOS clamps Chrome's minimum window width to 500px.

## Known limitations

- Tested in Chrome at an iPhone viewport, **not on a real iPhone**. Safari-specific
  behaviour — the share-sheet export, date input styling, home-screen install — is
  written to spec but unconfirmed.
- No rest timer, supersets, RPE, or warm-up/working set distinction. All were
  deliberately left out of v1.
- No Strava or Apple Health import. Runs are entered by hand.
