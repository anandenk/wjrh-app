# Archive demo (for showing the station board)

The Archive tab, built on made-up data and real album covers, so the idea can be shown before the station decides
anything about real archives (Decision 002). It is **demo only**: it plays no audio, and none of its recordings exist.
Paths beginning `src/` or `assets/` below are relative to `apps/mobile/`.

## What is real and what is made up

| Real | Made up |
|---|---|
| The list of shows, their names and hosts (from the API, i.e. the station's calendar) | Every archive recording, its date and its length is generated |
| Which weekday and how long each show airs (from this week's schedule), used to date the sample recordings | Playback: a clock and a position, no audio |
| The tracks in **Recently played** (from the station's feed), and each one's cover art (found online, see below) | Which album is a show's "cover": 36 well-known albums are handed out one per show, as stand-ins |
| The genres the station's calendar gives for eight shows | A genre line and a description for every other show (and a description for all 27): written for the demo, see below |
| The look of the screens (the design's Archive tab and archive detail page) | The picture for the Now screen on automation: The Smiths' *The Queen Is Dead*, chosen for the demo |

Screens say so in the design's own words: "album covers are placeholders", "Sample dates and recordings · proof of
concept". Each real show gets three sample recordings, a week apart, on its real air day (a show missing from this
week's schedule gets a steady made-up day).

## Sample descriptions and genres

The API has no description, genre or host bio for any show yet, and the station's calendar gives a genre for only
eight. In demo mode every show gets a **sample genre line and description** (`src/archive/demo-show-info.ts`), shown on
the show page (under the label **Sample description**, the design's own kind of label), on the archive page, and as the
genre on its Schedule row. They are short guesses from each show's name, and for the eight shows the calendar does
describe, they agree with it. They say nothing about the hosts as people, and **the hosts should write their own**.
They only fill gaps: a genre or description that really comes from the API or the calendar always wins, and a show not
in the list still gets a plain stand-in built from its name. Host bios ("About the host") are not made up, since those
would be statements about real students.

## Covers

All the covers are **other people's artwork**. That is fine for a private pitch and **not licensed for a release**.
The 36 album links and automation cover load from Apple's public image service and are cached on the phone;
five fallback covers are bundled in `apps/mobile/assets/images/`. Offline cache behavior still needs phone checks.

- **Shows (Archive grid, archive page, past broadcasts, show page, Now when a show is on air):** each active show gets
  its own album from `src/archive/demo-albums.ts` (36 albums, in an order where bright and dark covers alternate, so
  neighbours differ). The list holds links found with the iTunes Search API and checked by eye; show N gets album N.
  All of them are fetched when the app starts in demo mode. If one cannot be had, one of five bundled covers
  (`assets/images/demo-cover-*.jpg`, from the design) shows instead.
- **Now, while the station is on automation:** one real cover, `AUTOMATION_ALBUM` in the same file (a dark one, so the
  text over it stays readable).
- **Recently played:** each track's real cover is looked up with Apple's iTunes Search API when the row first
  appears (`src/archive/use-track-art.ts`). The title is cleaned first ("(Radio Edit)", "(Clean Version)", "(ft. X)", and an
  artist stuck onto the end of the title as the station's feed sometimes does), the artist has to match ("Verve" is "The
  Verve"), and the original album is preferred over a single, live version or compilation. Found covers are saved on the
  phone. The title and artist of each track are sent to Apple for this; nothing else is.
- **Generated covers, the fallback:** when no real cover is found (a student band, a name the catalogue does not
  have), the row keeps its **generated placeholder**: ten styles (sunburst, rings, stripes, halftone dots, waves, Bauhaus
  shapes, hills, patchwork, equalizer bars, rainbow arcs) in twelve colour palettes, drawn in code from the title and
  artist, the same every time. It is also what shows while the real cover loads.

## Turning it on

It is off unless you set `EXPO_PUBLIC_DEMO_ARCHIVES=1` when the app is bundled (also works in a Release build).
Run these commands from `apps/mobile/`:

```bash
EXPO_PUBLIC_DEMO_ARCHIVES=1 npx expo start            # simulator / dev build
EXPO_PUBLIC_DEMO_ARCHIVES=1 npx expo run:ios --configuration Release --device "<phone>"   # a phone build
```

Then: the Archive tab appears (four tabs), a show's page gets a **Past broadcasts** list, every show has a cover, and
Recently played shows real covers. `eas.json` must never set it for `preview` or `production`; `src/config.test.ts`
fails if any profile does. The five bundled covers are inside every build (they are app assets), so **replace or
remove `assets/images/demo-cover-*.jpg` before a public release.**

## Building the demo onto a phone

`apps/mobile/scripts/build-phone.sh` builds a signed Release app with your own Apple team and installs it on a connected
iPhone. A Release build carries its JavaScript, so the phone needs no Metro server and no Mac nearby. It needs Xcode
signed in with an Apple ID (a free account works, and the app then stops working after 7 days), an iPhone with
Developer Mode on, plugged in and unlocked, and these settings (run this example from the repository root):

```bash
DEVELOPMENT_TEAM=<your team id> \
WJRH_BUNDLE_ID=com.yourname.wjrh \
EXPO_PUBLIC_API_BASE=https://wjrh-api.anandenkhjin.workers.dev \
EXPO_PUBLIC_DEMO_ARCHIVES=1 \
apps/mobile/scripts/build-phone.sh --prebuild      # first time, after native settings/dependencies change, or after #27
```

- **`DEVELOPMENT_TEAM`:** your team's id. Open the generated project once in Xcode and pick your team under Signing &
  Capabilities, then read it from `ios/*.xcodeproj/project.pbxproj` (`DEVELOPMENT_TEAM = ...`), or take the Team ID from
  your account on developer.apple.com.
- **`WJRH_BUNDLE_ID`:** an id nobody else uses. The default `org.wjrh.app` is a placeholder your team will refuse.
- **`EXPO_PUBLIC_API_BASE`:** the demo API on Cloudflare (`docs/backend-proposal/deployed-demo.md`). With it the phone needs no
  Mac and no hotspot, only its own internet. A local API (`backend/scripts/dev-real.sh`) works too, but see the
  warnings in `status.md` before serving it to a phone: never on campus Wi-Fi.
- **The script also removes the Push Notifications capability** from the generated project. The app only schedules local
  reminders and never uses push, but Expo's notifications plugin asks for the capability, and a free team cannot have
  it ("Personal development teams do not support the Push Notifications capability").
- **First launch:** Settings > General > VPN & Device Management > your Apple ID > Trust. The demo then fetches its album
  covers (a few MB), so give it a few seconds with a connection once.
- **After 7 days** a free account's app stops opening: run the script again (without `--prebuild`).
- **Build verification (#23):** build, install and launch succeeded on the owner's iPhone. The full phone checklist,
  another machine/paid team, and a clean-checkout `--prebuild` run were not verified. #27's Expo patches still need a
  phone rebuild with `--prebuild` and fresh runtime checks.

## How it behaves

- **Archive tab:** a grid of every active show (cover, name, host). Tap a show for its archive page.
- **Archive page:** the cover with back-30, play/pause, forward-30 and a progress bar you can tap to seek; the show's
  name and description; the past broadcasts. Playing one starts the pretend player.
- **Player dock:** while an episode is loaded, the dock above the tab bar shows it (title, host and date, with a thin
  progress line) and its play button controls the episode. Tapping the text opens that show's archive.
- **Live and archive never play together** (the plan's rule): starting an episode stops the live stream, and pressing
  Play on the live stream ends the episode.

## Where the code is

| Piece | Path |
|---|---|
| Sample archive (shows → recordings, dates) and its tests | `src/archive/demo-data.ts` |
| The pretend player's rules and its tests | `src/archive/demo-player-state.ts` |
| Context that owns the player and keeps it exclusive with live audio | `src/archive/archive-player-provider.tsx` |
| The 36 show albums and the automation album (links only) and their tests | `src/archive/demo-albums.ts` |
| Sample genres and descriptions for the shows, and their tests | `src/archive/demo-show-info.ts` |
| Finding a track's real cover: cleaning, matching, picking (pure) and its tests; fetching and saving | `src/archive/track-art.ts`; `src/archive/use-track-art.ts` |
| Generated covers (pure) and its tests; the component that draws them | `src/archive/demo-art.ts`; `src/components/generated-cover.tsx` |
| Components that show a show's or a track's cover, and fetch the covers at start | `src/components/album-cover.tsx` |
| Hooks the screens read (`useArchiveCatalog`, `useDemoCover`, `useAutomationCover`) | `src/archive/use-archive.ts` |
| Screens | `src/screens/archive/` (grid, detail, transport, broadcast row, past broadcasts) |
| Routes | `src/app/archive/` |
| The flag, and a dev-only autoplay hook for screenshots | `src/config.ts` (`DEMO_ARCHIVES`, `DEV_ARCHIVE_PLAY`) |

## Turning the demo into the real thing (plan step 7)

The screens read their data through `useArchiveCatalog()`, so the seam is small: when the station decides, feed it
from `/v1/archives` and `/v1/shows/:id/archives` (already in the API and the generated types) instead of
`buildDemoArchive`, and replace the pretend player with Mixcloud's own player in a WebView (decision 002: audio must
stay inside Mixcloud's player, never through ours). Real covers come from each show's `artwork` in the API, and track
covers from a source the station is licensed to use (the API's now-playing already has an `artworkUrl` field, empty
today); the Apple lookups here are for the demo only. Still open with the station: whether to ship archives at all,
whether Mixcloud's widget terms allow embedding in a station app, and who records and uploads the shows.

## What was checked

Unit tests (the sample data, the pretend player's rules, the generated covers, the album list, the sample show info
(every real show has one; real data wins over it), and the track-cover matching built from real Apple responses), typecheck, lint and the contract check. On the iOS 27 simulator: the Archive
grid with the real album covers, an archive page while "playing", a show page with its past broadcasts, Schedule with the
dock, Now on automation with The Smiths cover, and the Schedule list and show pages with the sample genres and
descriptions; and Recently played with real covers found from the live feed,
against the real API running on the Mac. Every album in the list was looked at on a contact sheet to confirm it is the
right cover.

Those simulator checks predate #27; its patch versions were compiled for the simulator but not launched.
**Not checked:** the full real-iPhone checklist (a demo build was installed and launched, #23), Android, the Archive screens against the live API (they are built from `/v1/shows` and
`/v1/schedule/weekly`, which did not change), the Now hero with a show on air, how the covers load with no signal on a
phone that has never loaded them, how Apple's lookup behaves under its rate limit with a long list, and dragging the
progress bar (only tapping it).
