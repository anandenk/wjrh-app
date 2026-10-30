# App assets

Asset paths below are relative to `apps/mobile/assets/`; `src/` paths are relative to `apps/mobile/`, and
`frontend/` paths are relative to the repository root.

| Path | What | Where it came from |
|---|---|---|
| `images/*.jpg`, `images/contact.png` | Station photos used by the Now, Show and Station screens | `frontend/assets/`, resized to 1200 px wide at most (about 3x the widest slot). Credits: `frontend/assets/station-content-sources.md`. Not copied on purpose: `recent-cover-*` (placeholders, not real artwork), except as the demo covers below |
| `images/demo-cover-*.jpg` | **Demo only.** Five original geometric placeholder covers shown in demo mode (`EXPO_PUBLIC_DEMO_ARCHIVES=1`) while external demo album art loads, or if it can't. The real covers are not bundled: they load from Apple's image service (`src/archive/demo-albums.ts`, [`archive-demo.md`](../../../docs/mobile-app/archive-demo.md)) | Original procedural geometric artwork created for this prototype, replacing earlier commercial cover bytes. Existing JPEG filenames and dimensions are retained; provenance is in `frontend/assets/recent-cover-sources.md`. These placeholders are not supplied station artwork. |
| `fonts/barlow-condensed-extrabold.ttf` | "WJRH Display", the design's headline face | `frontend/fonts/` (SIL Open Font License, `OFL.txt` next to it). Inter, the body face, comes from the `@expo-google-fonts/inter` package |
| `icon.png`, `splash-icon.png`, `android-icon-*.png`, `notification-icon.png` | App icon, splash, Android adaptive icon (foreground, background, themed) and the Android notification small icon | Generated from `frontend/assets/wjrh-logo.svg`: gold wordmark on the station maroon `#861F2C`. The notification icon is a plain white broadcast symbol (Android tints it). These are my layout, not a supplied brand kit: the station may want to replace them |

The logo itself is drawn in code from `src/components/wjrh-logo-xml.ts` (the same SVG with the editor metadata stripped).
