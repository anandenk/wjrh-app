# Archived handoff: WJRH 104.9 FM Listener App (v2)

> Superseded planning document retained for history. It proposes an Expo/Node build
> that is not the current workspace implementation. The older prototype files it
> references now live in `_archive/legacy-root-prototype/`. Use the root `README.md`
> and `docs/backend/` for current status and planning.

## Overview
Mobile-first listener app for WJRH, Lafayette College's student-run freeform radio station (104.9 FM, Hogg Hall, Easton PA). The app has exactly three jobs: **start listening instantly, see what's playing now, see what's on later.** Everything else is secondary and lives behind an "i" button.

Targets: iOS and Android phones, plus a web build. **Stack decision: Expo (React Native + react-native-web)** with a small Node API. One codebase, native background audio via `expo-av` / `react-native-track-player`, web build for wjrh.org. If the team already has a stack, use it; the spec below is stack-agnostic.

## About the design files
- `WJRH App.dc.html` — interactive prototype, source of truth for layout, copy and behavior. Open in a browser. Tweaks panel exposes `stream` (state), `clock` (hour, ET) and `screen` (preset) so every state can be inspected.
- `WJRH Screen Map.dc.html` — one board with all 15 screens/states, for presenting.
- `WJRH App v1 (backup).dc.html` — superseded three-tab version. Reference only; do not build it.
- `ios-frame.jsx`, `support.js` — preview shell for the prototype. Not production code.

The prototype is a **design reference built in HTML**, not production code. Recreate it in the target stack.

## Fidelity
High. Colors, type, spacing and copy are final except the strings listed under "Confirm with the station". Design width 402px, single column; stretch to wider phones, and on web center a max-width 480px column on `#e9e7e1`.

## Decisions needed before build
1. **Stream URL** and what the encoder emits for metadata. Assume Icecast `StreamTitle` ("Artist - Title") unless told otherwise; if metadata is absent, the app shows the no-track-info state. Never look up album/year/artwork.
2. **Schedule source.** Default: `schedule.json` in the repo, edited by the station and redeployed. Shape below. Swap for a sheet/CMS later without UI changes.
3. **Interest-list destination** for the email form: Mailman subscribe, Google Form endpoint, or Airtable. `POST /join` wraps whichever.
4. **Background audio + lock-screen controls** are in scope for v1 (they add native config: iOS background mode "audio", Android foreground service). Confirm.
5. **Automation name.** "Hoggbot" is a placeholder.

## Information architecture
Two tabs + one persistent player.
- **Now** (default): header → show card → track card → Coming up (next 3) → Last hour (play log, mic breaks marked). Player pinned to the bottom of the viewport above the tab bar.
- **Schedule**: day picker → show rows. Row → **Show detail**.
- **Mini player**: on every screen except Now. Play/pause + status + title; tap → Now.
- **About**: via the "i" button on Now and Schedule headers. Station blurb, Host a show (sheet), Request a song, Support, socials. Back returns to the originating tab, which stays highlighted.
- **Sheets** (slide up over the page, no dimming, tap outside or CLOSE to dismiss): Track sheet, Host a show sheet, Reminder permission sheet.
- **Overlay**: First launch (once).

Launch → audio: one tap (play button or "Listen live" on first launch), in the thumb zone. No scrub bar, no per-track saves, no queue; this is a live stream.

## Design tokens
Section palettes. The page background and tab bar tint with the section (250ms ease). Each tab cell carries a 6px square in its color; the active cell is ink with its label in its section color.
- Now (+ track sheet): accent `#00e0a4`, dark `#00b586`, paper `#efece4`, pressed `#e2ded4`
- Schedule (+ Show detail, permission sheet): accent `#7b61ff`, dark `#5b42e0`, paper `#ece9f3`, pressed `#ddd8ee`
- About (+ Host a show sheet): accent `#ff5a1f`, dark `#d9430f`, paper `#f3e8dc`, pressed `#ecdccb`
- Ink `#111111`; disabled grey `#6b6b66`; web page background `#e9e7e1`

Type (Google Fonts, bundle in native)
- Display: **Syne 800**, uppercase, tight tracking (-.01 to -.03em). Show card 34px lh 1; screen titles 30–32px; sheet titles 26–30px; wordmark 24px; row titles 17–19px lh 1.1; first-launch hero 54px lh .95.
- Body: **Manrope** 400/500/700. Labels 10–11px 700 tracking .1–.14em uppercase; body 12–14px lh 1.5–1.6; time columns 11px/500; tab labels 12px 700 tracking .1em.

Shape: no border radius anywhere. Rules 3px (heavy) / 1px (light) ink. Hard shadows, no blur: player card `6px 6px 0 accent`; primary CTAs `4–5px 4–5px 0 accent-or-ink`. Press: translate(2–3px) and shrink shadow, 120–150ms.
Spacing: 18px gutters; rows 12–16px vertical; scroll area bottom padding 200px so nothing hides under the player.

## Screens

### Now
1. **Header**: "WJRH" (Syne 24) + pulsing 8px dot + "104.9 FM"; right: 32px square "i" button (2px ink border). 3px rule.
2. **Show card** (tap → Show detail): "ON AIR" / "UNTIL 4:00 PM" label row, show name Syne 34, "with {dj} · “{episode title}”" 13px. 3px rule.
3. **Track card** (tap → Track sheet): 52px ink square with 9 signal bars (accent when playing, grey squashed when idle), "NOW PLAYING" label, title Syne 17 (ellipsis), artist 13px. 3px rule.
4. **COMING UP**: next three slots after the current one, today. Time 62px column, name 14/700 uppercase, "{dj} · {genre}". Rows tap → Show detail.
5. **LAST HOUR** + "{n} tracks": play log newest first; mic-break rows (6px padding, pressed bg, "MIC BREAK"). Track rows tap → Track sheet.
6. **Player** (pinned): ink card, accent hard shadow. 64px play/pause (accent fill, 3px ink border; spinner when connecting/reconnecting; 50% opacity + grey when disabled), status label (accent), title Syne 16, "{artist} · {show}", 36px output-route button (border lights accent when not on phone speaker).

### Track sheet
Header "NOW PLAYING" or "PLAYED 2:37 PM" + CLOSE ✕. Title Syne 28, artist 15px. Row "PLAYED ON {show} · {dj}". Actions: **Find this track ↗** (ink fill, accent shadow; opens `https://www.google.com/search?q={title} {artist}`) and **Copy title** (outlined; writes "Title – Artist" to clipboard, shows COPIED ✓ for 2s). If the live track changes while the sheet is open, the label flips to PLAYED hh:mm.

### Schedule
1. Header: "SCHEDULE ET" + "i" button. 3px rule.
2. **Day picker**: 7 cells, today marked with a 5px square, selected = ink bg. Default today.
3. **Rows**: time 60px, name Syne 19 (17 for past), "{dj} · {genre}". Past slots at 45% opacity. Live row: accent bg + "ON AIR" chip (2px border). Reminded row: ink chip "⏰ 4:00 PM".
4. Empty day: "NO SHOWS SCHEDULED / Hoggbot runs all day."

### Show detail
Header "← SCHEDULE" (or "← NOW") + "{Day} {time}". Ink band: status ("ON AIR NOW" / "SHOW"), name Syne 32, genre. Host card: 52px accent square with initials, "HOSTED BY", name, one-line bio. Description 13px. "AIRS {Day} {time} ET, weekly". Actions: **Listen now** (live only; acts in place → "PLAYING ✓", no navigation) and **Remind me** (toggle → "REMINDER ON ✓" + confirmation line "We'll nudge you 10 minutes before…"). Then **PLAYED SO FAR** (live) or **LAST TIME ON AIR** (other): 5 tracks from the play log, tap → Track sheet.
Automation (Hoggbot): no actions, no playlist; one line "Rotation library, updated weekly…".

### Reminder permission sheet
First Remind me tap only. "ONE-TIME ASK", "ALLOW REMINDERS?", one paragraph, **Allow** / **Not now**. Allow → request OS permission, then store the reminder. Not now → store "denied", do not ask again in-app (Settings deep link later).

### About
Header "← NOW" / "← SCHEDULE" + "EST. 1946". Hero "FREE FORM RADIO." Syne 44 (orange period). Blurb. Rows: **Host a show →** (opens sheet), **Request a song OPEN ↗** (`tel:`), **Support the station OPEN ↗** (giving URL), **Instagram · wjrh.org OPEN ↗**.

### Host a show sheet
"HOW TO GET ON AIR" + CLOSE ✕. Title Syne 30, one-line intro, steps 01/02/03 (orange numerals). **YOUR EMAIL** input (3px ink border, red on error + "Enter a valid email address."), **Join the interest list** CTA (ink, orange shadow), privacy line. On success the form is replaced by a confirmation card ("YOU'RE ON THE LIST / See you at the GBM / sent to {email}") with "WRONG EMAIL? EDIT". Joined flag + email persist locally.

### First launch
Full-screen ink overlay: "104.9 FM · EASTON PA", hero Syne 54, one paragraph naming the current show, **Listen live** (accent, starts audio immediately), **Just look around**, note that notifications are asked only when setting a reminder. Shown once.

## Stream states
| state | player | elsewhere |
|---|---|---|
| live | play/pause, "TAP TO LISTEN LIVE" / "LIVE · PLAYING" | dot pulses |
| buffering | spinner, "CONNECTING…" | shown on every press until audio starts |
| reconnecting | spinner, "RECONNECTING…" | banner "Lost the stream for a moment. Retrying automatically." / RETRY NOW; dot stops; bars stop |
| nometa | title "Live from the booth", artist "Track info not posted yet" | track card 50% opacity, not tappable |
| streamdown | disabled (grey), "STREAM DOWN", title "Back at {next time}" | banner names next live show; its button sets that reminder → "REMINDER SET ✓"; show card label "NEXT UP" |
| offline | disabled, "NO CONNECTION" | banner "Showing the last thing we loaded…" / RETRY; last cached content stays |

Background audio: keep playing when backgrounded/locked; lock-screen shows title, artist, show name, WJRH artwork, play/pause only (no seek).

## Time model
- All slots are Eastern; UI labels ET. Convert to device time; keep the ET label when the zones differ.
- past / live / upcoming derive from `Date.now()` vs slot start/end. Never from list position.
- "Played so far" and "Last time on air" are views over one flat play log filtered by show start/end. There are no episode objects.
- Poll now-playing every ~15s while foregrounded; stop polling in background (metadata comes from the stream then).

## State (client)
`tab` (now | schedule | show | about), `from` (tab that opened show/about), `playing`, `connecting`, `selectedDay`, `sheet` (track | null), `joinOpen`, `permOpen`, and persisted: `reminders` (show id → true), `notif` (unasked | granted | denied), `joinedEmail`, `firstLaunchDone`.

## API shape
- `GET /stream` → `{ url, fallbackUrl? }`
- `GET /now-playing` → `{ title, artist, show, dj, episodeTitle?, endsAt, isAutomation, live: boolean }` (null title/artist → nometa)
- `GET /recent?limit=20` → `[{ title, artist, playedAt } | { type: "break", at }]`
- `GET /schedule` → `{ tz: "America/New_York", days: { mon: [{ id, startsAt, endsAt, show, dj, genre, description, host: { name, bio } }], … } }` (`schedule.json` in repo by default)
- `POST /join { email }` → 200; wraps the chosen list provider
- Reminders are local notifications; no server.

## Assets
- Fonts: Syne 700/800, Manrope 400/500/700/800 (Google Fonts; bundle).
- Icons: inline SVG paths only. Play `M7 4l13 8-13 8z`; pause two 5×16 rects at x=5 and x=14 (24 viewBox); speaker/route glyph as in prototype; "i", arrows, ✕ and ⏰ are text.
- No logo or artwork provided. Wordmark is set in Syne. Supply a 1024px square artwork for lock-screen/Now Playing.

## Accessibility
Icon-only buttons need labels: "About", "Audio output", "Close", "Play / Pause live stream". Text contrast is ink on paper (≥ 12:1); accent-on-ink labels (10–11px) are ≥ 7:1 for green/orange, ~5.5:1 for violet on ink; keep them ≥ 700 weight. Minimum hit target 44px (play 64, mini play 44, "i" 32 → pad to 44).

## Deferred
Landscape/tablet layouts, web layout beyond a centered column, analytics, custom output picker (use the OS route picker), listener chat, DJ directory, per-episode archives.

## Confirm with the station before launch
- Join process (email list vs. form), GBM week, alias `wjrh-join@mailman.lafayette.edu`
- Booth phone 610-330-5316, Instagram @wjrh, giving/merch links
- Founding year (1946); "around the clock" claim (is rotation always up?)
- Automation name ("Hoggbot")
- All show names, DJs, bios, episode titles and tracks are placeholders
