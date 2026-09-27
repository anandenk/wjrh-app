# WJRH 104.9 FM — Frontend Map

A functional inventory of the listener app: every screen, every control, every state.
Deliberately says nothing about how it is built or how it currently looks — both are
open. This describes **what the app does**, so a redesign can decide freely how it
should feel.

**The product in one line:** a phone-first app for a college radio station's listeners,
with three jobs — *start listening instantly, see what's playing now, see what's on
later*. Everything else is secondary and sits behind an info button.

Runs full-screen on a phone with no browser chrome, so the layout owns the whole
display including the status-bar and home-indicator zones.

---

## 1. Screens & Navigation

Four screens, four overlays. There are **two tabs**, not four — two of the screens are
pushed on top of a tab and remember where they came from.

```
┌─ Persistent across every screen ──────────────────┐
│  Player  (never disappears)                       │
│  Tab bar (2 cells: Now · Schedule)                │
└───────────────────────────────────────────────────┘

NOW ◄──── tab ────► SCHEDULE
 │                    │
 │  info button       │  info button
 ├──────────► ABOUT ◄─┤        (returns to whichever tab opened it;
 │                    │         that tab stays marked as active)
 │                    │
 └──► SHOW DETAIL ◄───┘        (reachable from both; back label reflects origin)

Overlays, one at a time, sliding up over whatever screen is below:
  · First-run introduction (shown once, ever)
  · Track details
  · How to get on air + sign-up form
  · Reminder permission request
```

Nothing is deep-linkable and there is no browser back behaviour — navigation is
entirely in-app.

---

## 2. Screens & Their Controls

### Now — the default screen

| Shows | Controls |
|---|---|
| Station name, frequency, and an indicator that animates only while audio is playing | **Info button** → About |
| A status message when something is wrong (see States) | **Retry** inside that message |
| What's on air now, and what time it runs until | **Tap the show** → Show detail. Inert when the automated rotation is on, since that has no detail page |
| The current track: title, artist, album when available, plus an animated indicator of playback | **Tap the track** → Track details. Unavailable when there's no track info |
| The next three shows, each with start time, name, host and genre. Rolls into following days, labelling the day when it does | **Tap any row** → Show detail |
| A log of what's played recently, newest first, with a count | **Tap any row** → Track details |

### Schedule

| Shows | Controls |
|---|---|
| Screen title, and that times are Eastern | **Info button** → About |
| A seven-day strip; today is marked distinctly from the day you're viewing | **Tap any day** → loads that day's shows |
| That day's shows: start time, name, host, genre. Rows indicate three conditions — already finished, currently on air, or has a reminder set (showing the reminder time) | **Tap any row** → Show detail |

### Show detail

| Shows | Controls |
|---|---|
| Back label naming where you came from, plus the show's full day and time | **Back** → returns there |
| Whether the show is on air right now or not, its name and genre | — |
| Host: initials, name, one-line bio | — |
| Show description, and when it airs (including whether it's weekly) | — |
| A confirmation line when a reminder is set, stating it's saved to this device | — |
| Tracks played: this show's session so far if live, otherwise its previous playlist | **Tap any row** → Track details |
| | **Listen now** — only on the currently-airing show. Starts audio **in place** and becomes a playing confirmation. Never navigates away |
| | **Remind me** — toggles on/off, becomes a confirmation when on |

The automated rotation short-circuits this screen: one explanatory line, no host, no
description, no playlist, no actions.

### About

| Shows | Controls |
|---|---|
| Back label naming the originating tab, plus the founding year | **Back** → returns there |
| A headline and a paragraph about the station's freeform, student-run identity | — |
| | **Host a show** → opens the sign-up overlay |
| | **Request a song** → dials the studio phone |
| | **Support the station** → opens the giving page externally |
| | **Instagram / website** → opens externally |

Rows leaving the app are visibly marked as doing so.

### Player — persistent, on all four screens

There is no separate "mini player"; it's the same component everywhere. **Three
independent targets**, kept apart so they don't swallow each other:

- **Play / pause** — the largest target in the app, positioned for thumb reach.
  Shows a loading indicator while connecting, and disables when there's nothing to
  play.
- **Text block** — playback status, track title, artist and current show. Tapping it
  opens Track details.
- **Output routing** — appears only on devices that can send audio elsewhere
  (external speakers, AirPlay). Hands off to the OS picker rather than building one.

### Tab bar

Two cells, **Now** and **Schedule**, with the active one indicated. About and Show
detail don't get their own cell — whichever tab opened them stays marked active, so
going back is always predictable.

---

## 3. Overlays

### First-run introduction (once, ever)
Full-screen. Station name and location, a headline, a paragraph naming what's on air
right now, and a note that notifications will only ever be requested if you set a
reminder.
**Controls:** **Listen live** (starts audio immediately and dismisses) · **Just look
around** (dismisses only).

### Track details
**Shows:** whether this is playing now or the time it was played; title, artist, album
when available; which show and host played it.
**Controls:** **Find this track** (external search) · **Copy title** (copies title and
artist, briefly confirms) · **Close**, tap outside, or Escape.
If the live track changes while this is open, the header switches from "now playing" to
the time it was played, rather than silently swapping the content underneath.

### How to get on air
**Shows:** a title and one-line intro, three numbered steps (join the interest list →
attend the general body meeting → claim a booth slot), an email field, and a privacy
note.
**Controls:** **Email field** (validates, shows an inline error) · **Join the interest
list** (Enter also submits) · **Close**, tap outside, or Escape.
**On success** the entire form is replaced by a confirmation card, with an **edit**
action to correct a wrong address. The address is remembered.

### Reminder permission
Appears **only on the first-ever "Remind me" tap**, never again either way.
**Shows:** that this is a one-time ask, and exactly what a reminder will do — one
notification, ten minutes before a saved show, nothing else.
**Controls:** **Allow** (then the OS's own prompt) · **Not now**. Either way the
reminder itself is still saved.

---

## 4. States to Design For

**Playback** — six states, each needing its own player treatment and, for the bottom
four, a message on Now:

| State | What the listener needs to understand |
|---|---|
| Idle | Audio is available; one tap starts it |
| Playing | Audio is live right now |
| Connecting | It's working on it |
| Reconnecting | The stream dropped and it's retrying by itself, with a manual retry available |
| Stream down | Nothing to play; when it's expected back, and which show is next. A reminder for that show can be set from here |
| Offline | No network; previously loaded content stays visible, play is unavailable |

**Missing track info** — a host broadcasting from their own laptop produces no track
data. The track area says so plainly and becomes non-interactive. This is common, not
an edge case.

**Empty and failed states** — each needs to explain itself rather than just being blank:

- A schedule day with no shows (the automated rotation fills it)
- Nothing in the recent-play log yet
- No upcoming shows to list
- The schedule failed to load — **and audio still works**, which the screen should make
  obvious

**Content variability** — show names, host names and track titles are user-entered and
frequently long. Genres are sometimes a full sentence. Bios are often empty. Layouts
need to survive all of that.

**Other behaviours that shape the design:**

- Audio keeps playing when the app is backgrounded or the phone is locked. The OS
  lock screen shows title, artist and show with play/pause only — no seeking.
- Between live shows an automated rotation plays. It's treated as a thing that's "on
  air" but has no host, no playlist and nothing to be reminded about.
- All times are shown in Eastern and are not converted to the device's timezone.
- Reminders, the saved email, and the recent-play log persist on the device only.
- The recent-play log covers the current session and can legitimately be empty.

---

## 5. Primary Flows

**A · Cold open → audio.** Launch → first-run overlay → *Listen live* → audio starts,
overlay clears, Now is behind it. **One tap.** Returning listeners land directly on Now,
where play is the biggest target on screen. No sign-in, no onboarding sequence, no
permission wall.

**B · "What is this song?"** Tap the track area, or the player's text block from *any*
screen → Track details → search for it or copy it. Works everywhere because the player
is always present.

**C · "What did they just play?"** Now → recent-play log → tap a row → Track details,
showing when it played.

**D · "What's on later?" → reminder.** Schedule → pick a day → tap a show → Show detail
→ *Remind me* → (first time only) permission overlay → confirmed, with the schedule row
now showing the reminder. Audio is never interrupted.

**E · "What's on right now?" → listen without losing your place.** Now → tap the show →
Show detail → *Listen now* → confirms in place, no navigation → back.

**F · Prospective DJ signs up.** Info button → About → *Host a show* → read the three
steps → enter email → submit → confirmation card replaces the form.

**G · Listener reaches the station.** About → call the studio to request a song, open
the giving page, or open social links.

**H · Something's broken.** Any degraded playback state keeps the listener oriented and
names the next thing that will happen — when audio returns, what's on next, or that
it's already retrying. Nothing ever just fails silently.

---

## 6. Interaction requirements

- Every tappable thing needs a **minimum 44px target**, measured as the real tap
  region, not the visible art.
- Every **icon-only control needs a text label** for screen readers: info, back, close,
  play/pause, audio output.
- **Reduced-motion must be honoured** — there are several looping animations
  (playback indicator, live indicator, loading spinners).
- Sheets are dismissible **three ways**: an explicit close control, tapping outside,
  and Escape.
- The active tab, the day being viewed, and today's date are three separate pieces of
  information and shouldn't collapse into one signal.

---

## 7. Hard rules

Not style constraints — these bound which features can exist at all. Worth knowing
before inventing, so good ideas don't get built and then discarded.

1. **Never show what's coming up musically.** Upcoming *shows* are fine and encouraged.
   Upcoming *songs, artists or albums* are not permitted under the station's
   broadcasting licence. No "up next: this track."
2. **Title, artist and album must be shown while a track plays.** Album is currently
   missing from the data and needs to appear as soon as it exists — design a place for
   it rather than treating it as optional.
3. **Playback stays non-interactive.** No queue, no picking songs, no replaying a
   track, no scrub bar, nothing that helps someone record the stream. It's a live
   broadcast, not a library.
4. **Reminders fire only while the app is open.** The interface shouldn't promise more
   than that.

---

## Quick reference

- **4 screens** — Now, Schedule, Show detail, About
- **4 overlays** — first run, track details, get on air, reminder permission
- **2 tabs**, and a player that never unmounts
- **~25 distinct controls**, listed per screen above
- **6 playback states** plus missing-metadata, four empty states, and one load failure
