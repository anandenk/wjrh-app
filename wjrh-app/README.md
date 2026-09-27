# WJRH 104.9 FM — listener web app

A mobile-first web app for WJRH, Lafayette College's student-run freeform station.
Three jobs: **start listening instantly, see what's playing now, see what's on later.**

No build step or runtime dependencies. The app is HTML, CSS and one JavaScript
file, with a locally served display font. Node and Playwright are optional
development tools for the automated UI checks.

---

## Run it locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Open `index.html` directly with `file://` and the
`fetch` calls will be blocked by the browser — always use a server.)

## Deploy it

Drag this folder onto [Netlify Drop](https://app.netlify.com/drop) or Cloudflare
Pages. It is a static site; anything that serves files works, including the
existing Jekyll site at wjrh.org.

**Serve it over HTTPS.** The stream and metadata are HTTPS, and the service
worker, home-screen install and notifications all require a secure origin.

---

## Where the data comes from

Everything here already existed before this app. Nothing new had to be stood up.

| What | Where | Notes |
|---|---|---|
| Audio | `https://internetstreamer.lafayette.edu/` | Shoutcast ICY, MP3 128 kbps, on Lafayette College infrastructure |
| Now playing | `https://nowplaying.wjrh.org` | Static JSON on S3/CloudFront, already sends `Access-Control-Allow-Origin: *`, updates once per track |
| Schedule | `schedule.json` | Generated from the station's public Google Calendar |

### Refreshing the schedule

The station edits its Google Calendar as usual. To pull those changes in:

```bash
python3 tools/fetch_schedule.py
```

That rewrites `schedule.json`. Commit it and redeploy. Run it at least at the
start of each semester. If the calendar ever disappears, `schedule.json` is plain
JSON and can be hand-edited — nothing else depends on Google.

The calendar convention is **`Show Name - DJ Name`**. The script splits on the
last dash, strips the HTML that Google Calendar puts in descriptions, and uses the
first line of the description as the genre. Keeping that convention tidy in the
calendar is the cheapest possible improvement to the app.

### Design previews and historical assets

`screenmap.html` loads the current production app in frames using
`index.html?state=<name>`. The preview hook also accepts
`window.__WJRH_PRESET`; it freezes polling and uses explicitly preview-only
fixtures to make states inspectable without relying on the live broadcast.
Those fixtures are not station editorial content.

`../_archive/wjrh-app-legacy-design-system/` is an older standalone Claude
Design export with its own copies of `app.js`, `styles.css`, and
`schedule.json`, plus token and component cards. It was moved out of the
production folder during the backend-readiness cleanup.
It has **not** been synchronized with the station-programme redesign. Use the
production app or `screenmap.html` to review the current UI. Before publishing
the standalone cards again, synchronize the source copies, include the local
`fonts/` assets, and update their old typography, shell markup, token cards,
and component examples. Copying only the three source files is insufficient.
Design changes still need implementation in production source; there is no
automatic round-trip from the exported cards.

### Auditing the front end

`tools/audit.js` measures the **running** app and flags the class of defect a
design review cannot see — implementation drift, not design decisions. Paste it
into the browser console on a running instance, then:

```js
await wjrhAudit()
```

It drives every screen (Now, Schedule, Show detail, About, and both sheets) and
returns findings. Re-run it at a few widths — 320, 375, 402, 430 and a desktop
size — since most of what it catches only appears at one of them.

| Check | What it catches | Real bug it came from |
|---|---|---|
| `UA_MARGIN` | element kept a browser default margin | `<dl>` sat low in its row |
| `OVERFLOW_X` | content wider than its box | "SCHEDULE" overflowed by 1px; step numerals by 3px |
| `HDR_WRAP` | a header wrapped to two lines | the same 1px overflow, visually |
| `OFF_CENTRE` | row content not vertically centred | the AIRS row |
| `LABEL_SKEW` | label/value optical centres disagree | AIRS label 1.2px off its value |
| `HIT_TARGET` | control smaller than 44px **as actually tapped** | back and close buttons were 37px |
| `DEAD_SCROLL` | empty scrollable space below content | 200px of leftover padding |
| `CLIPPED` | text cut off without an ellipsis | — |

`HIT_TARGET` probes the real hit region with `elementFromPoint` rather than
trusting `getBoundingClientRect()`, and skips controls that are deliberately
covered by an open sheet, scrolled past a fold, or clipped by an ancestor.
Without those exclusions it reports a pile of false positives.

This is a development tool and is not loaded by the app.

`tools/verify-ui.cjs` is an optional Playwright runner for viewport captures,
geometry/contrast checks, and interaction checks. Start the local server, then
run it with a Node environment where Playwright is available:

```bash
NODE_PATH=/path/to/node_modules node tools/verify-ui.cjs
```

The runner covers 320, 375, 402, 430, and 1366px viewports and writes screenshots
and a report to `verification/` by default. Set `WJRH_BASE_URL` for a different
server, `WJRH_BROWSER` for a Chrome executable, or `WJRH_OUT` for another output
folder. Inspect its results and screenshots; the presence of the runner alone
does not establish that a build passed.

### Regenerating the icons

```bash
python3 tools/make_icons.py
```

The current mark is the app's own signal-bar motif. **Replace it with the
station's real logo when there is one** — keep the filenames.

---

## Things you will probably want to change

All in the `CONFIG` block at the top of `app.js`:

- `automationName` — defaults to the descriptive **"Station rotation"**. Replace
  it only when the station supplies an approved name.
- `joinEndpoint` — blank by default. The interest form saves the address on this
  device and shows instructions to email `joinEmail`; it does not subscribe the
  person or launch a mail composer. A configured endpoint receives a POST with
  `{ email }`; its subscription and confirmation behavior must be integrated and
  verified before relying on it.
- `boothPhone`, `givingUrl`, `instagram` — verify these before launch.

---

## Known limits

Worth being straight about these, especially in a pitch.

1. **No station-wide play history.** The recent-track list is built from what
   *this device* observed while the app was open.
   Close the app and the history starts over. A real `GET /recent` needs a small
   server that polls the metadata feed and stores spins.

2. **No album field.** The metadata feed provides title and artist only. The
   statutory webcasting licence requires **title, artist and album** to be
   displayed. The current-track surface and detail sheet reserve an album line
   and show honest missing-data copy until the feed provides it. This remains a
   genuine compliance gap and should be fixed at the encoder, not here.

3. **Metadata dies when a DJ streams from their own laptop.** The feed reports
   `Null` and the app falls back to "Live from the booth / Track info not posted
   yet". wjrh.org documents the same behaviour. This is a station-operations
   problem, not a front-end one.

4. **Reminders only fire while the app is open.** Real scheduled notifications
   need either a push server or the native app. The UI is complete and honest
   about it; don't oversell it.

5. **Per-show playlists** ("last time on air") need the play log from (1).

6. **Editorial content is sparse.** The generated schedule has no host bios;
   its `genre` is derived from the first line of `description`. Many descriptions
   are blank or repeat the genre. Do not invent blurbs or biographies. The
   station's content request is in `../docs/content/STATION_CONTENT_BRIEF.md`; a separate
   editorial source and merge process are not part of this frontend.

7. **Host-interest submission is not connected by default.** Saving an email in
   the form does not subscribe it to the station's list; the confirmation gives
   the manual email step described above.

## Compliance notes — read before adding features

The stream runs under the Section 114 statutory licence. Two rules constrain
what this app is allowed to do:

- **Never publish an advance playlist.** Showing upcoming *shows* is fine.
  Showing which *songs, artists or albums* are coming up is not permitted, and
  would put the licence at risk. Do not add a "coming up next: track" feature.
- **Title, artist and album must be displayed** while a track plays (see limit 2).

Also: playback must stay non-interactive — no queue, no song picking, no
per-track replay, nothing that helps a listener record the stream. The design is
already built this way; keep it that way.

---

## Layout of the code

```
index.html    shell only — the audio element lives here, outside the render tree
styles.css    station-programme design tokens, responsive layout, and states
app.js        CONFIG, state, data fetching, audio + MediaSession, render, events
schedule.json generated — do not hand-edit unless the calendar is gone
sw.js         caches the shell; never caches the stream or the metadata feed
fonts/        local Barlow Condensed display face and its OFL licence
tools/        schedule/icon generators and optional frontend verification
```

`app.js` re-renders the whole screen on every state change. That is fine at this
size and keeps the data flow easy to follow, but `render()` **compares the new
markup against the last and only touches the DOM when it differs** — reassigning
`innerHTML` restarts every CSS animation inside it, which otherwise made the
signal bars and the pulsing FM dot jump back to frame 0 on every 15s poll and
every time a sheet opened.

When the markup genuinely does change (a new track, a tab switch) the elements
are recreated anyway, so `syncLoopingAnimations()` re-seeds those looping
animations with a negative `animation-delay` equal to the elapsed time. A
rebuilt bar carries on at the phase it would have been at. The delay is applied
in JS rather than baked into the HTML string, so the markup stays stable and the
diff above keeps working — don't move it into the template.

Three things are deliberately kept outside the render cycle: the `<audio>`
element (re-rendering must never interrupt playback), the overlay while someone
is typing in the email field, and the overlay while a sheet is animating out
(`closingOverlay`) — a poll landing mid-dismissal would otherwise rip the sheet
out instead of letting it slide down.

**Do not add `crossorigin="anonymous"` to the audio element.** The stream sends
no CORS headers, so requiring CORS makes playback fail outright with
`MEDIA_ERR_SRC_NOT_SUPPORTED`. A plain media element does not need CORS.

---

## Information architecture

- **Now:** the present broadcast, current track, and one next-live countdown.
  A compact today strip gives schedule context without duplicating a show list.
  The live-show clock derives from the actual slot duration, uses discrete
  marks, and offers no seeking or playback interaction. Rotation periods lead
  naturally to the next student show.
- **Schedule:** all show lists and direct reminder controls. The row and its
  reminder button are separate targets. Today, selection, on-air status, and
  saved reminders have distinct indicators; schedule freshness appears quietly
  below the programme.
- **Show detail:** meaningful blurbs or host bios justify a full destination.
  Rows without either expand in place; the live show remains reachable from
  Now. Genre text repeated or truncated into a description does not become a
  second blurb. Empty bios stay hidden.
- **Player:** play/status/output remain persistent. Now already shows the track,
  so its dock omits duplicate title and artist; other screens carry the full
  mini-player metadata and a path to track details.
- **Reminders:** saved on this device, with permission requested when relevant.
  The copy states that nudges require the app to be open. Reopening can surface
  a saved show that is on air or starting soon.

## Design

The **station programme** identity draws from printed radio schedules and
record sleeves: warm paper, deep red ink, bold condensed display type, clear
rules, and one prominent transport control. Station identity and frequency
appear in the first viewport; the listener experience remains the entry point.

Barlow Condensed 800 is served locally from `fonts/` (about 88KB, with its
licence in `fonts/OFL.txt`). Arial/Helvetica provides body text; the display
stack falls back to Arial Narrow, Impact, and the system sans-serif. The app
does not depend on external font or shader services.

Phones use the full viewport. At **760px and above**, the content has an 1100px
maximum width and Now becomes two columns. The persistent player and tabs sit
beside each other on desktop. There is no device frame. Safe-area padding and
a flex layout keep the player from covering the scrolling content.

Sheets belong to `#overlay` inside `#shell`, with a flat dimmed scrim. They rise
from the bottom on mobile and are centered on desktop. Modal focus stays in the
active sheet and returns to its trigger on dismissal. Visible keyboard focus,
44px control targets, stable album space, and reduced-motion styles are part of
the shared interface system.
