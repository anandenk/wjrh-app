# Audio spike (throwaway)

A tiny Expo app that plays the real WJRH stream with `expo-audio` and shows the player's state on screen. It
exists only to repeat the audio checks on a real phone (and to isolate audio problems from the real app). Results
so far and what is left: [`docs/mobile-app/audio-spike.md`](../../docs/mobile-app/audio-spike.md). It is **not**
the product; the real app is `apps/mobile/`.

What it does by itself (no taps needed): configures the audio session, polls the real now-playing feed, presses
Play after 3 s with lock-screen controls (live stream flag), logs a heartbeat every 5 s (also in the background),
switches to a bad URL at +100 s to show the error state, and back to the real URL at +115 s.

**It is silent by default**: `SILENT = true` at the top of `App.tsx` sets the player volume to 0 (it was written to
be run with the Mac muted). **For a phone test set `SILENT = false`.**

```bash
cd apps/audio-spike && npm ci
# set SILENT = false in App.tsx for audio you can hear
npx expo run:ios --device "<phone name>"      # see docs/mobile-app/iphone-test-checklist.md for signing tips
```

On Xcode 27 / iOS 27 it needs the UIScene setting already in `app.json` (`expo-build-properties`
`enableSceneSupport`). The heartbeat lines go to Metro's output (`npx expo start --dev-client`, not with `CI=1`).
