# Design polish (plan step 8)

The app now looks like the design in `frontend/index.html`: same colors, fonts, spacing, photos, tab bar and player
dock. This file says what was matched, where the app **deliberately differs** and why, and how to re-check it.

Checked on the **iOS 27 simulator** (iPhone 17, 402 pt wide) by taking a screenshot of every screen in the app and of
the same screen in the design, then comparing them side by side and by pixel position. The narrow-phone layouts (under
400 pt wide) were checked by raising the app's breakpoint above 402 for one run and forcing the design's narrow rules
at 402, which exercises the same styles. The **Android 16 emulator** (Pixel 6, 411 dp wide) was checked the same way
against the design at its size, for Now, Schedule, a show page and the Station hub (the other Station pages were not
looked at on Android): layout, fonts, tab bar, gesture-bar spacing and status-bar icon colors agree; the dock has no
blur there (see below). Still unchecked: a real iPhone or Android phone, a real 390/393 pt iPhone, and large text sizes
(see [`iphone-test-checklist.md`](iphone-test-checklist.md), section J).

## What was built

| Design piece | In the app |
|---|---|
| Body font Inter, headline font "WJRH Display" (Barlow Condensed ExtraBold) | `@expo-google-fonts/inter` and `assets/fonts/`; loaded in `src/app/_layout.tsx` while the splash screen stays up |
| Colors, gradients | `src/theme.ts` (values copied from the design's CSS) |
| Logo | `src/components/logo.tsx`, drawn from the design's SVG |
| Photos | `assets/images/` (resized copies of `frontend/assets/`), with the design's crops (`object-position`) |
| Now: photo canvas, state pill, big play control, "Recently played" | `src/screens/now/` |
| Schedule: sticky title, one list for the whole week with day bars, 24-hour times, "ON AIR NOW" row | `src/screens/schedule/` |
| Show page (the design's "archive detail" layout) | `src/screens/show/` |
| Station hub and its seven pages | `src/screens/station/`, copy and page layout in `src/content/station.ts` |
| Text-only tab bar with the sliding maroon bar | `src/components/tab-bar.tsx` (replaces the system tabs) |
| Glass player dock above the tab bar | `src/components/player-dock.tsx` |
| Icon, splash, Android notification icon | `assets/`, see `assets/README.md` |

## Where the app differs from the design, on purpose

1. **No Archive tab yet.** It is plan step 7 and waits for the station's decision (Decision 002). While
   `FEATURES.archive` is off the tab bar shows three tabs; with it on it shows four, as in the design.
2. **Show page.** Same layout, but: the header says SHOW (the design says ARCHIVE); the small heading above the name
   is the show's genre (the design says SHOW ARCHIVE); the design's "Generated prototype description" label is not
   shown, because the descriptions are real now; there is no "Past broadcasts" list (no archive), so the page has
   "On air" times, the reminder button and "About the host" there instead.
3. **No album covers.** The design's covers (Now canvas, recent tracks, archive tiles) are real album art copied as
   stand-ins, marked "must be replaced before any public release". The app uses the show's own artwork when the API
   has it, otherwise the station's collage; each recent-track row shows a different slice of that collage.
4. **Album line on Now.** The design shows title and artist only. The licensing rule in `CLAUDE.md` says title, artist
   *and* album, so the album sits under the artist when the feed has one.
5. **"Up next" line removed from Now** (the design has none; the Schedule tab shows what is next). Show-start dividers
   in the recent list ("Amber on Audio started") are not drawn: the API gives only tracks.
6. **Notices.** The offline / stream-problem / stale-data messages are not in the design, so they use its note card
   (cream, thin rim) above "Recently played". The pill says OFFLINE only when the API's health check says the stream
   is down.
7. **Team page.** The design's "Roster verified September 2026" line is replaced by "Station leadership changes
   regularly." (the list now comes from the API, so a fixed date would go stale). The roster is still hidden until the
   station approves it.
8. **Events page.** No "no upcoming events" line when there are archived events (the design just says "Event archive").
9. **Schedule.** The sync line shows the real sync date. The list opens at today's day bar (and again when you press
   the Schedule tab), but coming back from a show page keeps your place.
10. **Light only.** The design has one palette (cream and maroon) and no dark version, so the app stays light.
    Its other palettes are not built.
11. **Not built:** the design's hamster and dinosaur animations (leftover CSS, not on any screen); the browser-only swipe
    gesture (the native stack's own swipe-back is used).
12. **Small browser features React Native lacks:** `text-wrap: balance/pretty` (a few headlines may break lines
    differently), CSS `backdrop-filter` (the dock uses a native blur on iOS and a near-solid tint on Android), and
    the display font sits a hair higher in React Native, corrected by `DISPLAY_NUDGE` in `theme.ts`.
13. **Text size.** System text size is honored up to 130% (`src/components/text.tsx`); beyond that the fixed-height
    docks and rows would break.
14. **Icon and splash are my layout** (the logo on the station maroon), not a supplied brand kit.

## How to check it again

`tools/design-compare/` takes a screenshot of every screen of the design and of the app and puts them side by side;
its README has the steps. The app has three dev-only helpers for it (ignored in release builds): `EXPO_PUBLIC_DEV_ROUTE`
accepts `/route@600` to scroll a screen, each settled screen logs `[dev-shot N]`, and `EXPO_PUBLIC_DEV_NOW` fixes the
schedule's clock so "ON AIR NOW" can be seen at any hour.
