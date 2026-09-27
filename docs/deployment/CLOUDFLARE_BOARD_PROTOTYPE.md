# WJRH board prototype — Cloudflare Pages handoff

## Deployable artifact

- Upload `wjrh-design-preview-cloudflare.zip` with Cloudflare Pages Direct Upload.
- `index.html` is at the archive root, so the deployment opens at the project URL without a path suffix.
- The bundle is static and has no build step.
- `_headers` prevents search indexing and adds conservative browser security headers.

## Cloudflare Pages

1. Open **Workers & Pages** in the Cloudflare dashboard.
2. Choose **Create application** → **Get started** → **Drag and drop your files**.
3. Use a clearly provisional project name such as `wjrh-board-prototype`.
4. Upload `wjrh-design-preview-cloudflare.zip` and deploy it.
5. Open the generated `pages.dev` URL on both desktop and a phone before sharing it.

## What is real in this build

- Show names, hosts, weekly airtimes, durations, and supplied genres come from the WJRH public Google Calendar snapshot fetched September 22, 2026.
- Navigation between Now, Schedule, show pages, and Archive is implemented.
- Every unique show has its own page and description.

## What remains prototype content

- Show descriptions are generated copy and are visibly labeled as such.
- Album covers are remote prototype placeholders, not official show artwork.
- Archive dates, recordings, playback progress, recent tracks, and the simulated live state are fixtures.
- The Now screen is pinned to Amber on Audio to demonstrate a live-show state; it does not follow the real clock.

Do not present this artifact as a production launch. Replace the album covers and generated copy with station-approved content, and connect the real stream, metadata, schedule refresh, and archive service before any public release.
