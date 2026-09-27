# WJRH 104.9 FM — Frontend Restructure Proposal

A companion to `FRONTEND_MAP.md`. That document describes what the app **does today**.
This one proposes what it should **do instead**, and why.

Scope is deliberately narrow: **information architecture, screen composition, component
responsibilities, and interaction mechanics.** Nothing here specifies colour, type,
spacing or motion style. The visual language survives this change unaltered — every
proposal below is expressible in the existing component vocabulary.

---

## 0. The measurement that drives everything

Before proposing anything, the shipped `schedule.json` was measured. The numbers are
not incidental — they invalidate the current structure.

| Measure | Value |
|---|---|
| Live shows in the week | **28** |
| Live airtime | **29h of 168h — 17.3%** |
| Automation airtime | **139h — 82.7%** |
| Shows per day | **2 to 6** (Tue 2, Sat 2, Wed 4, Sun 4, Mon 5, Thu 5, Fri 6) |
| Live airtime window | **08:00–23:00 only**, concentrated 12:00–20:00 |
| Slots with **neither** a genre nor a description | **19 of 28 (68%)** |
| Of the 9 that have content, `genre` is a truncated copy of `description` | **9 of 9** |
| Slots with a non-empty host `bio` | **0 of 28** |
| Unique show names / slots | **27 / 28** — only *API on Air* airs twice |
| DJs hosting more than one show | **0 of 27** — show↔DJ is 1:1 |
| Co-hosted shows (two names in the `dj` field) | **5 of 28** |

**Why those three content fields are empty — this is a pipeline fact, not an editorial
one.** In `tools/fetch_schedule.py`:

- `bio` is **hardcoded to `""`** (line 210). There is no source for it. The pipeline is
  Google Calendar ICS → `schedule.json`, and an ICS `VEVENT` carries only `SUMMARY` and
  `DESCRIPTION`. **There is nowhere for a DJ to type a bio.**
- `genre` is **not a field**. It is `description.split("\n")[0]` passed through
  `shorten(limit=58)` (line 208). The generator's own comment states: *"The station does
  not record genre as a field."* The two slots where genre and description "differ" differ
  only by that truncation.

So `genre` and `description` are one field rendered twice, and `bio` has no origin at
all. This is addressed in §8.1.

Three consequences:

1. **"The next three shows" is not a preview of the schedule — on most days it is the
   schedule.** Tuesday has two shows total. Saturday has two. A three-item list on Now
   can exhaust an entire day and spill into the next one.
2. **The default screen is showing an automation placeholder roughly five visits out of
   six.** For 82.7% of the week, Now's hero is `Hoggbot · Rotation between live shows`.
3. **Show detail has almost nothing to show.** Name, a genre string printed twice, two
   initials, an airing time, one toggle. 68% of shows have no descriptive text at all,
   and no bio exists anywhere in the dataset or in the pipeline that produces it.

---

## 1. Diagnosis

The brief names one redundancy. There are three, and they share a root cause.

### 1.1 Now's "Coming up" vs. the Schedule tab — *redundant, then contradictory*

`renderNow()` calls `upcoming(3)`; `renderSchedule()` lists `slotsFor(S.day)`. Both
render show rows, both carry `data-act="open-slot"`, both land on Show detail. The two
components differ (`.row` vs `.showrow`) but the content and destination are identical.

Worse than duplication is what happens when they *stop* duplicating. `upcoming()` rolls
across midnight. On a Tuesday at 18:30 the schedule has nothing left, so Now displays
**Wednesday's** first three shows — while the Schedule tab, opened one tap later,
defaults to **today**, which is empty. The two surfaces disagree about which day they
are describing, and neither says so.

So: redundant when they overlap, incoherent when they don't. Either way two components
are doing one job.

### 1.2 The track is printed twice on Now — *unmentioned, more visible*

`renderNow()` draws `.trackcard` (label, title, artist, album, wave bars,
`data-act="open-track"`). `renderDock()` draws `.player-title` / `.player-sub` (title,
artist, show, `data-act="open-track"`). Same data, same destination, ~180px apart, on
the same screen.

`README.md` under "Information architecture" already specifies the fix and the build
diverged from it: *"**Mini player**: on every screen except Now."*

### 1.3 Show detail is a pushed screen with nothing in it — *the reason Schedule feels thin*

Given the data above, a representative Show detail renders:

```
← SCHEDULE                    Monday 12:00 PM
SHOW · The Rodeo · Folk and anti-folk
JR  Hosted by  Josie and Rosetta          ← no bio, none exists
Folk and anti-folk                        ← description, identical string, ~40px lower
Airs  Monday 12:00 PM ET, weekly
[ Remind me ]
Last time on air — "Per-show playlists need a station-side play log. Not available yet."
```

One push and one back, to reach one toggle. The Schedule tab's only affordance leads
to an empty room, which is why browsing the week feels unrewarding regardless of how
the rows look.

### 1.4 Root cause

**Now and Schedule are split by content type, and they overlap in the middle.** Now is
a mixed dashboard that includes a forward-looking list; Schedule is a browsable week
that includes the same forward-looking list. Any split defined this way leaks.

Critically, **deleting "Coming up" from Now does not fix this** — during automation it
is the only non-placeholder content Now has. Remove it and the default screen becomes
three apologies stacked vertically. The split itself has to change.

---

## 2. The structural move

**Re-cut the two tabs along time horizon instead of content type.**

| | Answers | Owns |
|---|---|---|
| **Now** | *"Should I be listening right now?"* | The present moment, plus **exactly one** forward pointer, expressed as a countdown — never a list |
| **Schedule** | *"When is the thing I want on?"* | **Every** enumeration of shows, and every reminder action |

One rule enforces it: **lists of shows exist only on Schedule.** Now may reference the
next show, but as a single countdown line, not a row in a list. The two surfaces can no
longer duplicate each other because they no longer share a component type.

This also collapses navigation state. `S.from` exists solely because two tabs push the
same Show detail. Under §3.3 that pathway is largely removed, and `S.from` survives only
for About.

---

## 3. Screen composition

### 3.1 Now — proposed

```
  Header            WJRH · 104.9 FM · live dot          [i]
  Banner            degraded states only — unchanged
┌─────────────────────────────────────────────────────────┐
│ ON AIR   The Rodeo · with Josie and Rosetta             │  ← §4.1 show clock
│          ▪▪▪▪▪▪▪▫▫▫▫▫  38 min left                      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ NOW PLAYING   title / artist / album                    │  ← album line reserved §4.5
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ TODAY  ░░░░██░░████░░░░░▲░░░░██░░░░░░░░░░░░              │  ← §4.2 day density strip
│        6a      12p      ▲now      6p      12a           │
└─────────────────────────────────────────────────────────┘
  NEXT LIVE   Barthalomew & The Aquarium · in 2h 12m         ← §4.3 one line, not 3 rows
┌─────────────────────────────────────────────────────────┐
│ RECENT   track · artist                     3:41 PM     │
│ ── Earworm started · 7:00 PM ──────────────             │  ← §4.6 show dividers
│          track · artist                     7:04 PM     │
└─────────────────────────────────────────────────────────┘
  Dock      [ ▶ ]  LIVE · PLAYING                    [ ⇱ ]   ← text block suppressed §4.4
```

Changed from today: the three-row "Coming up" list is gone, replaced by one countdown
line. The dock's text block is suppressed **on this screen only**. Everything else is
an addition inside an existing card.

### 3.2 Schedule — proposed

```
  Header            Schedule  ET       [i]
                    Updated Sep 18                           ← §4.8 freshness
  Day strip         MON TUE [WED] THU FRI SAT SUN
                          •        •                         ← reminder dots §4.7
                        today  selected
  Rows              1:00 PM  Fatou Talks                [🔔]  ← inline toggle §4.9
                             Fatou · Talk
                    5:00 PM  Amber on Audio  ON AIR     [🔔]
                             ▾ expands in place              ← §3.3
  Empty day         "Hoggbot runs all day.
                     Next live show: Wed 1:00 PM, Fatou Talks."   ← forward pointer
```

Schedule becomes the only list of shows *and* the only place reminders are managed.

### 3.3 Show detail — keep the screen, gate it on content

**Resolved:** the station will supply blurbs and host bios (§8.1 covers how). That
justifies a pushed screen, so Show detail is **retained as a real destination** rather
than demoted to an inline row.

It should still be **gated on content, permanently** — not as a workaround for today's
empty fields, but because coverage at a volunteer station will never be 100%. There are
27 shows with student DJs and semester turnover; a DJ who starts in October will have a
blank bio in October. The gate handles both worlds with one rule and needs no revisiting:

| Condition | Row behaviour |
|---|---|
| Blurb **or** bio present | Row pushes to **Show detail** — the full screen |
| Neither present | Row **expands in place**: host, airing pattern, reminder toggle, and *Listen now* when live. No push into an empty room |

So the same rule that removes 19 dead-end pushes today resolves to "push" for every show
once the station's content lands, with no code change in between.

Two rules apply on the screen itself regardless:

- **Never render `description` when it equals `genre`.** They are the same field today
  (§0) and may stay correlated after §8.1. One conditional removes a visible stutter.
- **The host block renders only when `bio` is non-empty.** Initials plus a name the row
  already showed is not worth a card.

The **live** show keeps its direct path from Now's on-air card (Flow E), so the screen is
reachable even for a show with no content.

### 3.4 Tab bar — unchanged at two cells

Two tabs stay. A third (Shows, DJs, Hosts) is not justified by 28 slots and zero bios,
and reminders are handled inline on Schedule rather than needing a home of their own.

---

## 4. Proposed components

Each entry states what it replaces, so the net element count can be checked.

### 4.1 Show clock — elapsed/remaining within the airing show
**Where:** on-air card, Now. **Replaces:** the static `UNTIL 1:00 PM` string.

`38 min left` is decision-grade; `UNTIL 1:00 PM` requires the listener to do the
arithmetic. Shows are 60 minutes, so the remaining figure is the single most
behaviour-changing number on the screen.

> **This is not a scrub bar.** It derives from `schedule.json`, not from the audio
> element. To keep that unambiguous it must: render as **discrete ticks** (12 × 5 min),
> never a continuous filled bar with a rounded cap; carry **no handle and no tap
> target**; and live **only on the on-air card**, never inside the player dock. Hard
> rule §7.3 is about playback interactivity — this is a broadcast clock and touches
> nothing playable.

### 4.2 Today strip — 24-hour density band
**Where:** Now. **Replaces:** nothing directly; occupies part of the space vacated by
"Coming up".

A compressed band of today's live windows against the automation background, with a
"you are here" marker.

This is the only element in the proposal that can express the 82.7% honestly. On a
Tuesday, a listener currently cannot distinguish "nothing on today" from "something
great in an hour" without opening Schedule and reading rows. The strip answers it in a
glance, in roughly 40px, and — because it is a density band rather than a list — it
cannot re-create the §1.1 duplication.

**Constrain it to stay a glance object:** live blocks are tappable to that show;
tapping the background opens Schedule at today. Nothing else. Reminder ticks may mark
saved shows. It must never grow labels per block, or it becomes a list again.

### 4.3 Next-live countdown — one line, replacing three rows
**Where:** Now. **Replaces:** the entire `upcoming(3)` list.

`Barthalomew & The Aquarium · in 2h 12m`. Permitted explicitly by hard rule §7.1
(upcoming *shows* are encouraged; upcoming *tracks* are forbidden).

During automation this line is promoted into the on-air card itself, so the most-seen
state in the app — `Hoggbot`, 82.7% of the week — stops being a placeholder and becomes
the most useful thing on screen: *what ends this, and when.*

When the stream is down, this line is already the natural primary content; the existing
`streamdown` banner logic collapses into it rather than duplicating it.

### 4.4 Dock text suppression on Now
**Where:** dock. **Replaces:** the duplicate title/artist/show block, on Now only.

On Now the dock renders the play button, the status label, and the output control — no
title, no artist. On Schedule, Show detail and About it renders in full, so Flow B
("what is this song?" from any screen) is untouched. The player still never unmounts.

This is the README's original specification, restored. It is a variant of one component,
not a second component.

### 4.5 Reserved album line
**Where:** track card and track sheet. **Replaces:** the current conditional render.

Hard rule §7.2 requires album to have a designed place before the feed carries it. Today
`renderNow()` omits the line entirely when album is absent, so the card will change
height the day the encoder starts sending it. Reserve the third line permanently and
fill it with a plain *"Album not posted"*.

Album belongs on the **track card and sheet only** — not in the dock, which is capped
at three lines and already carries status/title/artist.

### 4.6 Show dividers in the play log
**Where:** recent list, Now. **Replaces:** nothing; a divider inside the existing list.

`── Earworm started · 7:00 PM ──` between tracks logged under different shows. This
converts a flat track list into a session history, and gives the log meaning during
automation blocks too. The README's API shape already anticipates markers in this list
(`{ type: "break", at }`).

### 4.7 Reminder dots on the day strip
**Where:** Schedule day picker. **Replaces:** the need for any "my reminders" screen.

A dot under a day that contains a saved show. Requirement §6 insists today, the selected
day, and the active tab stay three separate signals — a reminder dot is a *fourth*
channel on an existing control and must be positioned so it does not collide with the
`today` or `sel` treatments.

### 4.8 Schedule freshness line
**Where:** foot of Schedule. **Replaces:** nothing; one line.

`schedule.json` carries `generatedAt` and nothing surfaces it. A stale file makes the
app lie confidently — countdowns, on-air state and reminders all inherit the error.
Surface it quietly, and treat >14 days as a soft warning.

### 4.9 Inline reminder toggle on schedule rows
**Where:** Schedule rows. **Replaces:** the push/toggle/back round trip.

Flow D ("what's on later" → reminder) is the app's second most important flow and
currently costs a screen push and a back. A toggle on the row collapses it to one tap
and makes Schedule *actionable* rather than a list of links.

The row then carries two targets (open/expand, and toggle), so both need their own
44px region per §6 — the toggle sits in the existing `.showrow-chips` area, which is
already reserved space.

### 4.10 Saved-show catch-up on open
**Where:** Now banner. **Replaces:** nothing — it closes the gap in hard rule §7.4.

Hard rule §7.4 concedes reminders fire only while the app is open, which means the
feature is inert for the exact case it exists for. The structural answer is to make the
reminder pay off on the next open instead: if a saved show is on air now or starts
within the hour, Now leads with *"You saved Earworm — it's on now."*

This is the highest-value single addition in the document, because it is the only thing
that makes Flow D deliver anything at all when notifications don't fire.

Its companion is honest copy. The present confirmation reads *"We'll nudge you 10
minutes before… Saved on this device."* — which promises a notification the app cannot
guarantee. It must say so.

---

## 5. Net element count

| Removed | Added |
|---|---|
| `upcoming(3)` list on Now — 3 rows | Next-live countdown — 1 line |
| Dock text block on Now | Today strip — 1 band |
| Duplicate `description` on Show detail (26/28) | Show clock — inside existing card |
| Show detail push for 26/28 shows | Inline remind toggle — inside existing row |
| | Log dividers — inside existing list |
| | Freshness line — 1 line |
| | Reminder dots — inside existing day cells |

Now sheds three rows and a text block, and gains one band plus inline text. **The
default screen gets structurally lighter, not heavier.** Five of the seven additions
live inside components that already exist.

---

## 6. Hard-rule check (`FRONTEND_MAP.md` §7)

| Rule | Status |
|---|---|
| §7.1 No upcoming tracks | **Held.** §4.2/§4.3 forecast shows only. Nothing in the proposal names a future song, artist or album. |
| §7.2 Title/artist/album while playing | **Improved.** §4.5 gives album a permanent reserved line instead of a conditional one. |
| §7.3 Playback non-interactive | **Held, with care.** §4.1 is a schedule-derived clock, not a scrub bar — discrete ticks, no handle, no tap target, never in the dock. Called out because it is the one item that could be misread. |
| §7.4 Reminders fire only while open | **Held and improved.** §4.10 turns the constraint into a feature and corrects the over-promising copy. |

Interaction requirements (§6): §4.9 introduces a second target on schedule rows — both
need real 44px regions. §4.2's strip needs a text alternative describing today's live
windows. §4.1 and §4.2 both animate position; both must freeze under
`prefers-reduced-motion` and render their current value statically.

---

## 7. Implementation constraints this design must respect

- **`render()` is a full innerHTML rebuild** of `#app` and `#dock`, string-diffed
  (`app.js:860`). A 30s re-render tick and a 15s poll already exist. Minute-granularity
  countdowns are therefore free; **second-granularity is not** — it would rebuild the
  DOM every second and restart every CSS animation. Design all countdowns to minute
  resolution (`in 2h 12m`, `38 min left`), never `mm:ss`.
- The strip and clock must be **pure functions of `schedule.json` + `etNow()`** so they
  stay correct in the `offline` state, where previously loaded content must remain
  visible.
- No new timers, no new fetches, no new persisted state. Everything above reads state
  that already exists.

---

## 8. Decisions this forces

### 8.1 Where does per-show content live? — **blocking, and not yet decided**

The station has agreed to write blurbs and bios. That is necessary but not sufficient:
per §0, **there is no field to write them into.** `bio` is hardcoded `""` and `genre` is
a truncated slice of the calendar description. Willingness is not the blocker; schema is.

Two ways forward.

**Option A — keep Google Calendar as the only source, formalise a convention.**
DJs structure the event description as: line 1 = genre list, blank line, then the blurb.
`fetch_schedule.py` already splits on `\n` for genre; `description` would change to
"everything after line 1". *Bio still has no home* unless a third convention is added
(e.g. a `Host:` prefixed line).
Cost: no new infrastructure. Risk: unenforceable free-text convention, maintained by
rotating student DJs, silently breaking the app when someone reformats their event.

**Option B — a second source for per-show content. (Recommended.)**
A small `shows.json` or Google Sheet holding `genre`, `blurb` and `bio`, merged onto
calendar slots by the generator. **The calendar keeps owning *when*; the sheet owns *what
and who*.**
Why it fits this station specifically: 27 unique shows, show↔DJ is **1:1** (§0), and the
content changes about once a semester while the calendar changes weekly. Those are two
different edit rhythms and two different editors, so they want two different files. It
also survives a DJ reformatting a calendar event.

**Keying, under either option.** `uid` is the Google event id and breaks when an event is
recreated; `show` name breaks on rename; `id` (`mon-1200-the-rodeo`) encodes the timeslot
and breaks when a show moves. A content file therefore needs a **stable slug the station
owns**, with the generator warning loudly on any unmatched key rather than silently
dropping the content.

**Co-hosted shows.** 5 of 28 slots list two people (`Sonia Pattie and Lawson Campbell`,
initials `SL`). Since show↔DJ is 1:1, the bio should be **one per show, not one per
person** — no schema change, and it reads naturally for solo and duo shows alike.

### 8.2 Already settled

3. **Automation name.** `Hoggbot` is still flagged as a placeholder, and it is now the
   most-read string in the app at 82.7% of airtime. It should be confirmed before this
   ships, not after.
4. **Reminder honesty.** Confirm the copy change in §4.10, since it narrows a promise
   already made in the shipped build.

---

## 9. Considered and rejected

- **A third tab (Shows / DJs).** 28 slots, zero bios. Nothing to fill it with.
- **Share a show, or notification deep-links into a show.** Blocked by
  `FRONTEND_MAP.md` §1: *"Nothing is deep-linkable."* Worth re-opening as a decision,
  because several otherwise-obvious features die on this one constraint.
- **Swipe or long-press affordances.** Hidden gestures are wrong for a station app with
  casual, infrequent listeners. Everything above is a visible target.
- **Merging Now and Schedule into one scrolling screen.** Tempting at 28 shows, but it
  breaks Flow A: the play button must stay the largest, most reliably placed target in
  the app, and a single long scroll compromises that.
- **Any artwork, year, or album lookup.** Explicitly forbidden by `README.md` §"Decisions
  needed", item 1.
