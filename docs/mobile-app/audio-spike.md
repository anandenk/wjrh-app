# Audio spike: `expo-audio` on the real stream

- **Date:** 2026-10-01
- **Code:** the throwaway app `apps/audio-spike/`, since removed; git tag `archive/audio-spike` has it
  (`git checkout archive/audio-spike -- apps/audio-spike`)
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
  `app.config.ts` in `apps/mobile`). Expo SDK 58 is expected to do this by default.
- **Metro must not run with `CI=1`**, or it ignores file changes and serves a stale bundle.
- Metro must listen on IPv4 (default `expo start`), not `--localhost`, for the simulator at
  `127.0.0.1`.

## An earlier run of the same spike (2026-09-28)

A first spike run, by an earlier session, was never committed; its findings are kept here. Same setup (iPhone 17
simulator, iOS 27, Expo SDK 57, muted at volume 0), a scripted set of checks against the real stream. It reached the
same verdict (**use `expo-audio`**) and measured some things the later run did not:

| Check | Result |
|---|---|
| Cold start | Audio flowing after **about 7 s** (7.1 s and 7.4 s over two runs); `isLive: true`, `duration: 0`. Normal for this stream: show "connecting…" |
| Pause 15 s, then plain `play()` | Resumed **where it paused, 15 s behind live**. This is why the real app reconnects (`replace()` then `play()`) on every Play |
| `replace(stream)` + `play()` | Rejoined live, about 7 s to audio |
| A URL answering 403 | One status event with an error message, then stuck "buffering" forever |
| Server unreachable | One status event with an error ("Could not connect to the server."), then stuck "waiting" forever |
| Recover after an error | `replace(stream)` on the same player recovered, about 7 s to audio |
| `currentOffsetFromLive` | Always `null` for this stream, so how far behind live we are can't be read |
| Station streamer paths | It serves the stream at **any** path, so a wrong path is not a broken URL (use an unreachable host to test failures) |

Two lessons from it that the real player should honor:
- **The error arrives as an event, once.** Read it from the status updates as they happen, not by polling later
  (a later poll showed `null`). The real app uses the hook's status updates.
- **A failed or stalled player waits forever, so add a timeout.** The real player retries when it sees an error
  event. A stall that raises **no** error (the connection dropping mid-stream) used to leave it on "Connecting…"
  forever (reproduced: 95 s+ stuck, even after the stream came back). The real app now has a watchdog (PR #19): not
  audible for 15 s while playback is wanted, so reconnect, waiting 15, 20, then 30 s between tries. Checks E1 to E3
  in [`iphone-test-checklist.md`](iphone-test-checklist.md) confirm it on a real network.

Other notes from that run: Expo Go can't be driven without a screen (iOS asks "Open in Expo Go?"); a development
build opens directly. The `expo-audio` config plugin adds the iOS `audio` background mode by default.

## What changed after the spike

`expo-audio` was adopted for the real app (`apps/mobile/src/audio/`, PR #13), which adds what the spike lacked:
its own fallback to the built-in stream URL and timed retries after an error, a reconnect at the live edge on
every Play (no rewinding), one app-wide player, and lock-screen text from the real now-playing data. The simulator
checks of that code are in [`apps/mobile/README.md`](../../apps/mobile/README.md). The spike app was then removed
(tag `archive/audio-spike`), because the real app covers everything it tested.

## Still to do on a real iPhone

See the full, current checklist (build steps and a results log): [`iphone-test-checklist.md`](iphone-test-checklist.md).
