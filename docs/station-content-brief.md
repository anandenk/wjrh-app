# WJRH App — Show Content Brief

**For:** the station (music directors / station manager)
**Why:** the listener app has places to show what each show *is* and who hosts it. Those
places are currently empty, because the Google Calendar the schedule is built from has
nowhere to put them. This sheet is that missing place.

**What we need:** three short fields per show, for 27 shows. Nothing else changes — the
calendar keeps owning the schedule itself.

---

## The three fields

### 1. Genre — max 48 characters
A short comma-separated list. Shown on every schedule row and under the show name.

- Good: `Folk and anti-folk` · `Indie, alternative, oldies` · `Hip-hop, soul, jazz`
- Too long: `Eclectic, alternative, metal, jazz, soul, R and B, electronic, etc.` (67) —
  this one currently gets cut to `Eclectic, alternative, metal, jazz, soul, R and B…`
- **Over 48 characters is truncated with an ellipsis.** Three or four genres, not eight.
- Avoid `etc.`, `ect.`, `everything` — they tell a listener nothing. If a show really is
  all over the place, `Eclectic` is the honest one-word version.

### 2. Blurb — max 200 characters, 1–2 sentences
What the show actually is. Shown on the show's own page, under the title.

- Write it for **someone who has never heard the show** and is deciding whether to stay.
- Present tense, no "Welcome to…", no times (the app already shows those).
- Good: `Two hours of folk, anti-folk and whatever Josie found at the record store on
  College Hill this week. Requests welcome.`
- **This must not repeat the genre list.** The app hides the blurb when it matches the
  genre, so a duplicate means the show's page shows nothing.

### 3. Host bio — max 140 characters, one sentence
Who is behind the mic. Shown on the show's page beside the host's initials.

- **One bio per show, not per person.** Five shows are co-hosted; write those as a pair
  (`Sonia and Lawson are juniors who met in the booth and never left.`).
- Year / major / a detail is plenty. Good: `Fern is a sophomore from Vermont who has
  strong opinions about banjos.`
- Optional, but a show with a bio looks considerably less empty than one without.

---

## Ground rules

- **Plain text only.** No links, emoji, line breaks or formatting — they will not render.
- **Leave a cell blank rather than writing a placeholder.** The app is built to hide an
  empty field cleanly; it cannot hide `TBD` or `N/A`.
- **Do not edit the Slug column.** It is how the app matches your text to the right show.
  If a show is renamed or moves timeslot, keep the slug and tell us.
- Accuracy over polish — we can copy-edit, we cannot invent.

---

## The sheet

27 shows. The Genre column is pre-filled with whatever the calendar already contains —
confirm it, replace it, or fill the blank.

| Slug (do not change) | Show | Host(s) | Airs | Genre — existing | Genre (≤48) | Blurb (≤200) | Host bio (≤140) |
|---|---|---|---|---|---|---|---|
| `alternative-sound` | Alternative Sound | Jamya | Sat 2:00PM | — |  |  |  |
| `amber-on-audio` | Amber on Audio | Amber | Wed 5:00PM | — |  |  |  |
| `api-on-air` | API on Air | Cassie | Thu 5:00PM + Fri 5:00PM | — |  |  |  |
| `barthalomew-the-aquarium` | Barthalomew & The Aquarium | Ben | Mon 7:00PM | — |  |  |  |
| `basement-jams` | Basement Jams | Darby | Wed 7:00PM | — |  |  |  |
| `c-squared` | C SQUARED | Cora and Cassie | Thu 1:00PM | — |  |  |  |
| `earworm` | Earworm | Calvin | Wed 6:00PM | — |  |  |  |
| `fatou-talks` | Fatou Talks | Fatoumata | Wed 1:00PM | — |  |  |  |
| `fern-s-folk-fun` | Fern's Folk Fun | Fern | Thu 10:00AM | — |  |  |  |
| `freak-show` | Freak Show | Sofie Nordstrom | Sun 11:00AM | — |  |  |  |
| `giuseppe` | Giuseppe | Cameron and Mats | Tue 5:00PM | — |  |  |  |
| `harry-son-s-hits` | Harry Son's Hits | Harrison | Sun 6:00PM | Pop/Sports talk |  |  |  |
| `j-j-jams` | J-J-Jams | Janella and Josie | Fri 3:00PM | — |  |  |  |
| `mayo-s-mix` | Mayo's Mix | Mayloni Belcher | Mon 4:00PM | — |  |  |  |
| `mouthpeace` | MouthPeace | Lorelai | Sun 8:00PM | — |  |  |  |
| `naive-melody` | Naive Melody | Koby | Tue 6:00PM | — |  |  |  |
| `off-the-record` | Off The Record | Jolie | Fri 6:00PM | — |  |  |  |
| `playlist-of-the-month` | Playlist of the Month | Ella Selnick | Thu 7:30PM | — |  |  |  |
| `postmodern-jrh` | Postmodern JRH | Scott | Sun 8:00AM | — |  |  |  |
| `rock-on-evening` | Rock on Evening | Isabella Mazza | Sat 5:00PM | Rock, pop punk, emo, alternative |  |  |  |
| `sarah-smiles` | Sarah Smiles | Sarah | Mon 2:00PM | Music/Popculture (movies, shows, etc.) |  |  |  |
| `soupburger` | SoupBurger!! | Sonia Pattie and Lawson Campbell | Thu 4:00PM | everything |  |  |  |
| `supercut` | Supercut | Reese | Fri 4:00PM | Indie, alternative, oldies |  |  |  |
| `the-bit` | The Bit | Tom | Fri 7:00PM | Eclectic, alternative, metal, jazz, soul, R and B, electronic, etc. |  |  |  |
| `the-rodeo` | The Rodeo | Josie and Rosetta | Mon 12:00PM | Folk and anti-folk |  |  |  |
| `the-spinoff-with-orry` | The Spinoff with Orry | Orry | Mon 3:00PM | HipHop, soul, jazz, rock, ect. |  |  |  |
| `what-s-poppin-radio-show` | What’s Poppin’? Radio Show | Téo | Fri 10:00PM | — |  |  |  |

---

## Two more things to confirm

1. **The automation name.** Between live shows the app currently says **"Hoggbot"**,
   which is a placeholder we invented. It is the most-read word in the app — the station
   is live 29 hours a week, so listeners see this name for the other 139. What should it
   actually say?
2. **A one-line description of the automation** to sit under that name. Current
   placeholder: *"Rotation library, updated weekly by the music directors."* — is that
   true?
