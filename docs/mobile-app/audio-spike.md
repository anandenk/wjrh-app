# Audio spike: `expo-audio` on the real stream

- **Date:** 2026-10-01
- **Code:** `apps/audio-spike/` (throwaway; not the real app)
- **Tested on:** iPhone 17 **simulator**, iOS 27.0, Expo SDK 57 (`expo` 57.0.26, `expo-audio` 57.0.5),
  dev build. Real stream `https://internetstreamer.lafayette.edu/`, real feed `https://nowplaying.wjrh.org`.
- **Silent test:** the Mac was muted and the spike's player volume was set to 0, so nothing was
  audible. Playback was checked from the player's status (`playing`, `currentTime`), not by ear.

## Simulator results

| Check | Result |
|---|---|
| Plays the real stream | **Pass.** `playing=true`, `isLive=true`, position advances 1 s per second |
| Keeps playing in the background | **Pass.** App sent to the background (Safari opened) for ~45 s: still playing, position kept advancing |
| Lock-screen / Control Center registration | **Registered.** `setActiveForLockScreen(true, metadata, { isLiveStream: true })` sends now-playing info to iOS (seen in the system log). How it *looks* needs a real phone |
| Error on an unreachable URL | **Detected, but no recovery.** Status shows `error: "Could not connect to the server."`, `playing=false`, `isBuffering=true` forever |
| Recover after an error | **Pass.** Switching the source to the real URL and calling `play()` plays again within ~3 s |
| Live-stream flag | `isLive=true`; `isLiveStream: true` hides the scrub bar and seek buttons |

## What this means for the real app

- **`expo-audio` works for live audio on iOS so far.** `react-native-track-player` is not needed
  unless the phone tests below fail.
- **The app must do its own fallback.** `expo-audio` does not retry or fall back: after an error it
  sits there "buffering". The app needs to watch `status.error`, then swap in the built-in fallback
  URL (or retry) and call `play()`. This matches the rule that live audio never depends on the API.
- **Empty feed values.** `https://nowplaying.wjrh.org` returned empty artist/title at least once
  (the spike showed an empty track). Treat empty strings as unknown, not as a track.
- **Feed values are URL-encoded** (`Smalltown%20Boy`); the API already decodes them, a direct
  client must too.

## Setup gotchas found on the way (Xcode 27 / iOS 27)

- **The Simulator app is gone in Xcode 27.** It is replaced by `DeviceHub.app`
  (`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`). Without opening it the simulator
  runs with no window.
- **iOS 27 crashes apps that don't use the UIScene lifecycle** (SIGTRAP at launch, before any JS).
  Fix for Expo SDK 57.0.23+: `expo-build-properties` with `ios.enableSceneSupport: true` (see
  `apps/audio-spike/app.json`). Expo SDK 58 is expected to do this by default.
- **Metro must not run with `CI=1`**, or it ignores file changes and serves a stale bundle.
- Metro must listen on IPv4 (default `expo start`), not `--localhost`, for the simulator at
  `127.0.0.1`.

## What changed after the spike

`expo-audio` was adopted for the real app (`apps/mobile/src/audio/`, PR #13), which adds what the spike lacked:
its own fallback to the built-in stream URL and timed retries after an error, a reconnect at the live edge on
every Play (no rewinding), one app-wide player, and lock-screen text from the real now-playing data. The simulator
checks of that code are in [`apps/mobile/README.md`](../../apps/mobile/README.md). `apps/audio-spike/` is kept only to
repeat these audio checks on a phone or to isolate an audio problem: [`apps/audio-spike/README.md`](../../apps/audio-spike/README.md).

## Not testable on the simulator: do these on the iPhone

The full, current checklist (with build steps and a results log) is
[`iphone-test-checklist.md`](iphone-test-checklist.md); this short list is the original from the spike.

1. **Lock-screen and Control Center look and controls:** title, artist, album shown; play/pause
   works; no scrub bar or skip buttons.
2. **Locked-screen playback:** lock the phone, wait several minutes, confirm audio keeps playing.
3. **Phone-call / Siri / other-app interruption:** audio pauses, and resumes (or doesn't) sensibly.
4. **Headphones / Bluetooth:** unplugging pauses playback; AirPods and car controls work.
5. **Real network changes:** Wi-Fi to cellular, a dead zone, airplane mode: does the app recover?
6. **Silent switch:** with `playsInSilentMode: true`, audio plays with the ring switch off.
7. **Long run:** 30+ minutes in the background without being killed.
8. **Android** device: foreground-service notification, and the ~3 minute background limit noted in
   the `expo-audio` docs (needs `setActiveForLockScreen`).
