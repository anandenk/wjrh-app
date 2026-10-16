# design-compare

A dev tool, not part of the app. It checks that the app still looks like the HTML design: it screenshots every screen
of both and puts them side by side. How the current app was checked: [`docs/mobile-app/design-polish.md`](../../docs/mobile-app/design-polish.md).

You need: macOS with Chrome, Xcode's iOS simulator with the dev build installed (see `apps/mobile/README.md`), and
internet (the design loads React from unpkg.com).

```bash
cd tools/design-compare && npm ci          # playwright-core (drives your Chrome) and sharp (images)

# 1. The design, as an iPhone 17 would show it (402 x 874 points, notch and home indicator)
(cd ../../frontend && python3 -m http.server 8765 --bind 127.0.0.1) &
node design-shots.mjs /tmp/design ios      # narrower phone: VW=390 VH=844 TOP=47 node design-shots.mjs /tmp/design-390 ios
```

```bash
# 2. The app. Metro runs with the data the design shows and a route list; each settled screen logs "[dev-shot N]"
cd ../../apps/mobile                      # from tools/design-compare above
EXPO_PUBLIC_USE_FIXTURES=1 EXPO_PUBLIC_DEV_NOW=2026-10-14T19:10:00-04:00 APP_VARIANT=development \
EXPO_PUBLIC_DEV_ROUTE="/,/@9000,/schedule,/schedule@1,/schedule@9000,/schedule/basement-jams,/station,/station@9000,/station/about" \
  npx expo start --dev-client --port 8081 > /tmp/metro.log 2>&1 &
../../tools/design-compare/watch-shots.sh /tmp/metro.log /tmp/app now-top now-bottom schedule-today schedule-top \
  schedule-bottom show-top station-hub-top station-hub-bottom station-about-top &
xcrun simctl openurl booted "exp+wjrh://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081&disableOnboarding=1"
```

`@600` after a route scrolls that screen 600 points (a big number means "to the bottom"). Screens are 5 seconds apart.
The fixtures show no show on air and one recent track, so for a like-for-like picture temporarily edit
`apps/mobile/src/api/fixtures/{now-playing,recent,station}.json` (a live show, five recent tracks, `approved: true`)
and **restore them with `git checkout` afterwards**.

```bash
# 3. Compare. Design on the left, app on the right.
cd ../../tools/design-compare             # from apps/mobile above
node compare.mjs /tmp/schedule.png /tmp/design /tmp/app schedule-top schedule-bottom
node bands.mjs rows /tmp/design/schedule-top.png      # bars and rows down one column, in points
node bands.mjs rows /tmp/app/schedule-top.png         # ...should give the same numbers
node bands.mjs text /tmp/app/schedule-top.png 18 200 70 160   # where text sits inside a box
CLICKS='.station-row-link:has-text("History")' node measure.mjs STATION .info-list-item   # a size in the design
```

Expect the pictures to differ where the app deliberately differs ([design-polish.md](../../docs/mobile-app/design-polish.md#where-the-app-differs-from-the-design-on-purpose)):
artwork, the Archive tab, the show page's archive list. The normal app has no Archive tab; the demo flag enables sample
archives and album covers. Layout, sizes and text positions should agree to about a point.
