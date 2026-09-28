# Decision 002: Archive options and licensing

- **Status:** Proposed. The launch decision belongs to the board.
- **Date:** 2026-09-28
- **Related:** [Decision 001](001-hosting-on-cloudflare.md) and
  [`../rollout-plan.md`](../rollout-plan.md) (Phase 3).

## Context

The design's Archive tab offers:
- one page per show;
- past broadcasts;
- on-demand play with seek and ±30 s.

Nothing like this exists today, and it is the only feature with real licensing exposure.

WJRH ran per-show archives before. [Teal](https://github.com/wjrh/Teal) (2016–2018) recorded each
show when the DJ pressed "Start episode" and "End episode", logged tracks by hand, and published
podcast feeds. That shows the station has done it, not that it was licensed; podcast downloads go
further outside the webcasting licence than on-demand streaming does.

**The licensing problem.** WJRH webcasts under the statutory licence for sound recordings
(17 U.S.C. §114). That licence covers *non-interactive* streaming and attaches conditions to
"archived programs." As we read §114(d)(2)(C)(iii):
- an archived program **shorter than five hours** is not eligible;
- a program of five hours or more is eligible only if it's available for **two weeks or less**.

Almost every WJRH show is one or two hours long, so serving recorded music shows on demand from our
own storage is **probably not covered**. Musical-work rights (ASCAP, BMI, SESAC, GMR) are a separate
question. This is our reading, not legal advice, and the station and college must confirm it.

The existing rules in [`../current-systems.md`](../current-systems.md) ("Licensing rules for any frontend") still apply:
- no advance playlists;
- no per-track interactivity.

## Proposal

Design the archive so the storage provider can change later, and ship it **switched off** until
the board picks a path.

```
recorder (small cloud server)     API (Worker + D1)                storage (S3 API)
────────────────────────          ─────────────────                ────────────────
watches /v1/schedule
records each opted-in show
registers the episode ──────────> episode 'uploading' + one-time upload URL
uploads the file ───────────────────────────────────────────────> archives/<show>/<id>.mp3
marks it ready ─────────────────> checks the file exists and is audio → 'pending_review'
                 staff: publish / unpublish / delete   (every action logged with who did it)
listeners: /v1/shows/{id}/archives lists published episodes only ──> audio straight from storage
daily: episodes older than the retention window are deleted (default 14 days)
```

Safeguards:
- **Nothing at the station.** The recorder runs on a cloud server and records the public
  stream, the same audio listeners hear (128 kbps MP3). No booth hardware and no on-site setup.
- **Opt-in by show.** The recorder records only shows on an approved list. There is no default.
- **Nothing is public without a staff decision.**
- **Immediate takedown.** Unpublishing takes effect at once, and deleting removes the file. Both are
  logged.
- **Retention is enforced by a scheduled job, not by memory.**
- **The API never passes audio through itself.** The storage host must support HTTP range requests
  so listeners can seek.

## What the station already pays (live streaming)

Streaming WJRH live needs two kinds of licence, which the station or college should already hold:

| Licence | Covers | Cost per year |
|---|---|---|
| SoundExchange | The recordings (labels and artists) | $800 minimum in 2026, rising to $1,000 by 2030; plus $100 to skip detailed reporting |
| ASCAP and BMI | The songs (songwriters and publishers) | About $432–1,118 each by 2027, based on enrollment |
| SESAC and GMR | The songs, for their catalogues | SESAC about $204–1,673 by 2027; GMR set the same way |

The SoundExchange minimum covers up to about 160,000 listening hours a month. Archive listening
would count toward that, but WJRH is far below it.

## Options for the board

The two realistic ways to archive music shows are **Mixcloud** and **whole-day blocks**. Talk-only
archives can run alongside either.

### Option 1: Mixcloud (per-show archives)

Each show is recorded from the calendar and uploaded to a station-owned Mixcloud account. The app
plays it through Mixcloud's embedded player. Mixcloud holds its own licences and pays labels and
artists, so the station needs no extra music licence.

- **Cost:** about $16–20 a month in total.
  - Mixcloud Pro is $11.25 a month billed yearly, or $15 monthly.
  - The cloud recorder is about $5 a month.
- **Organisation:** one episode per show per week, on each show's archive page, kept as long as the
  station likes. The tracklist comes from the play history.
- **Limits for free listeners, set by Mixcloud's licensing deals:**
  - fast-forward up to 6 times and rewind up to 6 times per show per rolling hour;
  - replay each show up to 4 times per rolling 14 days.
- **How the limits are enforced:** by Mixcloud, in its own player and on its servers. The audio never
  leaves Mixcloud, and our ±30 s buttons only ask its player to seek. Signed-in listeners are counted
  by account, anonymous ones by device. The station can't switch the limits off and doesn't have to
  police them.
- **Unlimited listening is available if listeners pay:**
  - a WJRH channel subscription (from $2.99 a month, price set by the station, which gets a share)
    unlocks unlimited listening on WJRH shows;
  - Mixcloud Premium (about $8 a month) unlocks it everywhere.
  
  The station can't buy either for everyone.
- **To check:** Mixcloud's widget terms mention non-commercial and personal use, so confirm that
  embedding in a station app is fine. Uploads also have publishing rules and require tracklists.
- **Trade-off:** Mixcloud branding and player inside the Archive tab, and the recordings live on
  Mixcloud rather than in our storage.

### Option 2: Whole-day blocks, kept for 2 weeks (self-hosted)

Each day's full broadcast is archived as one long program, well over 5 hours, in our own storage
and deleted after 14 days. This follows the statutory licence's rule that archived programs must
be at least 5 hours long and available for no more than 2 weeks, so it needs no licence beyond
what the station already pays, **if counsel confirms it qualifies**.

- **Cost:** about $5 a month: the cloud recorder, plus about $0.25 a month of storage.
- **Organisation:** by day. The calendar marks where each show starts inside the day, so a show page
  can point to "Tuesday, 5:00 PM". The recorder records around the clock instead of per show.
- **Listener freedom:** no platform limits. Listeners can pick a day and time and skip freely,
  unless counsel says the program must play from its start.
- **To confirm with counsel:**
  - that a 24-hour block counts as one archived program;
  - that listeners may jump straight to a show inside it;
  - that the songwriter licences (ASCAP, BMI, SESAC, GMR) cover it.
- **Trade-off:** only 2 weeks back, and organised by day rather than by show.

### Other options

| Option | Extra licensing cost | Notes |
|---|---|---|
| **Talk-only archives** | $0 | Speech belongs to the host. Music inside still counts. Can run alongside option 1 or 2. |
| **Own per-show archive with direct label licences** | No realistic price | Needs deals with every major and independent label plus publisher licences, usually with large advances. Not available to a student station. |
| **No archive** | $0 | Hide the Archive tab. Keep station-wide recently played and past tracklists. |

**Recommendation:**
- Use **Mixcloud (option 1)** for per-show music archives, and accept its listener limits.
- Optionally offer a WJRH channel subscription for listeners who want unlimited listening.
- If the board rejects the limits, use **whole-day blocks (option 2)** once counsel confirms them.
- Start talk-only archives whenever hosts want them.

## Open questions

1. Who at the station or college can approve a licensing position in writing?
2. Retention: 14 days, a semester, or per show?
3. Who reviews and publishes episodes, and how soon after a broadcast?
4. Which cloud provider hosts the recorder, and which station account pays for it? Ask Lafayette IT
   too whether the stream server already has a built-in archive feature, which would replace the
   recorder.
5. How do hosts request a takedown?
6. Does WJRH currently file with SoundExchange, and who holds the ASCAP, BMI, SESAC and GMR licences?

## Sources

- [SoundExchange: noncommercial educational webcasters](https://www.soundexchange.com/service-provider/non-commercial-webcaster/non-commercial-educational-webcaster/)
- [37 CFR Part 380 Subpart C](https://www.ecfr.gov/current/title-37/chapter-III/subchapter-E/part-380/subpart-C)
- [Inside Radio: songwriter rates for college radio](https://www.insideradio.com/free/noncommercial-and-college-radio-will-pay-more-to-songwriters-under-crb-decision/article_0a413026-9e1c-11ed-84b6-37105d2013b0.html)
- [Mixcloud Pro](https://www.mixcloud.com/pro/)
- [Mixcloud: rewind and fast-forward limits](https://help.mixcloud.com/hc/en-us/articles/360004054059-Why-are-there-limits-for-rewinds-and-fast-forwards)
- [Mixcloud: replay limits](https://help.mixcloud.com/hc/en-us/articles/360010592220-Why-can-I-only-replay-a-show-four-times)
- [Mixcloud: which subscription is right for me](https://help.mixcloud.com/hc/en-us/articles/360004030700-Which-subscription-is-right-for-me)
- [Mixcloud Widget API](https://www.mixcloud.com/developers/widget/)
- [Mixcloud terms](https://www.mixcloud.com/terms/)
