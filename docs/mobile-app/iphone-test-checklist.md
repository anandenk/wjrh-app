# Real-phone test checklist

Everything here is **untested on a real device**; the simulator cannot do it. Run it on a physical iPhone, tick
what passes, write down what does not, and commit the filled-in file. Status and context:
[`status.md`](status.md). If the audio items in sections B to D fail with `expo-audio`, try
`react-native-track-player` (the plan's fallback) before building more screens.

## Set up

**You need:** an iPhone with Developer Mode on (Settings > Privacy & Security > Developer Mode), a cable, Xcode
signed in with your Apple ID (a free personal account works; apps expire after 7 days), and the phone and the Mac on
the **same Wi-Fi**. Only run the LAN steps on a network you trust.

**1. Start the API where the phone can reach it.** The real-station one shows live data and hands out the real
HTTPS stream URL (safest for audio/lock-screen checks):
```bash
API_HOST=0.0.0.0 backend/scripts/dev-real.sh     # API on port 8797, read-only against WJRH's real services
ipconfig getifaddr en0                           # this Mac's LAN IP, e.g. 192.168.1.20
```
(`dev.sh` takes `API_HOST` too, but its fake stream stays on the Mac's `127.0.0.1`, so the phone would fall back to
the real stream anyway.)

**2. Build the app onto the phone.** The app's native settings (bundle id, and the development-only permission to
use plain HTTP to your Mac) are written into the generated `ios/` folder, so set the variables, regenerate that
folder, then build. `org.wjrh.app` is a placeholder id and a personal Apple ID usually needs its own:
```bash
cd apps/mobile && npm ci
xcrun devicectl list devices                     # your phone's name or identifier
export APP_VARIANT=development                   # allows HTTP to your Mac's LAN address; never for a real release
export EXPO_PUBLIC_API_BASE=http://<LAN IP>:8797 # fixed into the build
export WJRH_BUNDLE_ID=com.yourname.wjrh          # only if the default id is rejected when signing
npx expo prebuild --clean --platform ios         # regenerates apps/mobile/ios (gitignored); redo if you change any of the above
npx expo run:ios --device "<phone name>"         # builds, installs, and starts Metro for the dev build
```
If Xcode complains about signing, open `apps/mobile/ios/*.xcworkspace`, pick your Team under Signing & Capabilities,
then re-run. On the phone, trust the developer profile (Settings > General > VPN & Device Management). On first
launch iOS asks to allow **local network** access: Allow (the app needs it to reach the API on your Mac).
The dev build also needs Metro reachable from the phone (it connects to the Mac over the same Wi-Fi).

**3. For the long checks (B4, B8), use a Release build** so the phone does not depend on the Mac's Metro server
(the dev-only test hooks are off in a Release build, which is what you want). Same variables and `prebuild` as above, then:
```bash
npx expo run:ios --device "<phone name>" --configuration Release
```
(`APP_VARIANT=development` is still needed so iOS allows plain HTTP to your Mac; a real release talks HTTPS to a
deployed API.) The API address is fixed at build time.

**To isolate an audio problem** from the rest of the app you can restore the removed spike: `git checkout archive/audio-spike -- apps/audio-spike`
(set `SILENT = false` in its `App.tsx` for audible audio; it is a throwaway, see [`audio-spike.md`](audio-spike.md)).

## Checks

Tick `[x]` for pass, write `FAIL: what happened` otherwise.

### A. Basics
- [ ] A1. App launches and shows the tabs Now, Schedule, Station (no Archive).
- [ ] A2. Now shows the current show/track from the API (same as the real station's now-playing).

### B. Live audio
- [ ] B1. Tap **Play live**: audio starts within about 7 s (normal for this stream); the button goes "Connecting…" then "Pause".
- [ ] B2. Pause: silence immediately. Play again: you hear what is on air **now**, not where you paused (compare with
      the stream on another device). This is the "no rewinding" rule.
- [ ] B3. Switch to another app for 5 minutes: audio keeps playing.
- [ ] B4. Lock the phone for 10+ minutes: audio keeps playing, then unlock: the app's button still says Pause.
- [ ] B5. Ring/silent switch on silent: audio still plays.
- [ ] B6. When the on-air track changes, the Now tab updates within about 15 s.
- [ ] B7. A track with no artist shows "Artist metadata unavailable" (only if one comes up; not an error otherwise).
- [ ] B8. 30 minutes locked/in the background: no stutter, no drop. Battery used: ____ %.

### C. Lock screen and Control Center
- [ ] C1. Lock screen shows the track title, artist and album (or the show name), and a play/pause button, with **no
      scrub bar and no skip buttons** (it is a live stream).
- [ ] C2. Pause from the lock screen: audio stops and, when you open the app, it shows **Play live** (state follows).
- [ ] C3. Play from the lock screen after pausing: audio resumes **at the live edge** (not old audio) and the app shows
      Pause. *(The path that has only been exercised in code.)*
- [ ] C4. Same card and controls in Control Center.
- [ ] C5. Earbud/headphone play-pause button toggles playback.
- [ ] C6. Lock-screen text changes when the track changes.

### D. Interruptions and routes
- [ ] D1. Phone call while playing (ask someone to call, or FaceTime): audio pauses. After the call, record what
      happens: resumes / stays paused: ________. Either is acceptable if the button matches the audio.
- [ ] D2. Siri request or an alarm: same, record: ________.
- [ ] D3. Start Music/a podcast: ours pauses. Record whether it resumes afterwards: ________.
- [ ] D4. Unplug headphones (or disconnect Bluetooth) while playing: playback pauses.
- [ ] D5. Connect Bluetooth/CarPlay: audio routes there and the controls work.

### E. Network
- [ ] E1. Airplane mode while playing: button says "Reconnecting…". Turn it off: audio comes back within about 20 s
      **without tapping anything**. *(The stall watchdog should reconnect on its own: expect "Reconnecting…" after about 20 s without
      audio, then sound again. Verified on the simulator only; record how long it took here: ____ s.)*
- [ ] E2. Turn Wi-Fi off mid-play (cellular on): audio recovers.
- [ ] E3. Launch with no network: Now shows "You're offline…" (with "Showing last known info from …" if the app ran
      before); Play says "Reconnecting…"; once online the notice goes away by itself and it plays.
- [ ] E4. Stop the API on the Mac (Ctrl-C in `dev-real.sh`) while the stream is fine: Play still works, and Now says
      "Live audio still works."
- [ ] E5. Saved answers survive a restart: with the app online, open Now, Schedule and Station once. Force-quit,
      turn on Airplane mode, reopen. Schedule and Station still show their content (not "couldn't load"), and Now
      shows the last known show with the offline notice. The Mac API being off gives the same result.
- [ ] E6. Coming back online: turn Airplane mode off with the app open. The offline notice goes away within a few
      seconds and Now shows what is on air now, without pulling to refresh.

### F. Schedule and reminders
- [ ] F1. Schedule: today is marked, times match the station's published schedule, "ON AIR NOW" matches the radio.
      Set the phone's time zone to another zone: times still show **Eastern**.
- [ ] F2. A show page shows hosts, when it airs, and honest "hasn't added a description" text where missing.
- [ ] F3. Tap **Remind me when it starts**: the iOS notification permission prompt appears; Allow; the button shows
      "Reminder on".
- [ ] F4. A reminder for a show starting soon arrives at its start (banner when the app is open, lock screen when not).
      Tip: pick the next show on the schedule, or create one with the fake-calendar scenarios in
      [`backend/TESTING.md`](../../backend/TESTING.md) (use `dev.sh` for that, with `API_HOST=0.0.0.0`).
- [ ] F5. Tap the reminder: the app opens on that show's page.
- [ ] F6. Turn the reminder off: it no longer arrives.
- [ ] F7. Force-quit and reopen: a reminder you set still shows as on.
- [ ] F8. Deny permission (Settings > Notifications > WJRH > off), then tap the button: the app says notifications are
      off and tapping the message opens Settings.

### G. Station
- [ ] G1. The hub opens all seven pages. Team says "Team list coming soon" (the roster is not approved).
- [ ] G2. Contact: the email opens Mail with the subject `#readnow`; the phone number offers to call; the studio
      opens a map.
- [ ] G3. Support opens the donation form. Instagram, Facebook and the FCC file open.
- [ ] G4. Events shows an archive (and any upcoming events) and "View event archive" opens wjrh.org/events.

### H. General
- [ ] H1. Dark mode and the largest text size: nothing unreadable or cut off (the design is not finished; just record).
- [ ] H2. VoiceOver: buttons are announced with sensible names (Play live stream, day names, show rows).

### I. Android (if a device or emulator is available; not run at all so far)
- [ ] I1. Run B1 to B6 and D4, E1. Check the media notification appears and its controls work, and that audio survives
      more than 3 minutes in the background (the documented `expo-audio` limit without lock-screen controls).
      Emulator API address is `http://10.0.2.2:<port>`; a phone uses the LAN IP.

## Results log

| Date | Device and iOS version | Build | Tester | Summary |
|---|---|---|---|---|
| | | | | |

After a run: fix or file what failed, update the "Not verified" lists in [`status.md`](status.md),
[`audio-spike.md`](audio-spike.md) and [`../../apps/mobile/README.md`](../../apps/mobile/README.md), and tick the
matching sections of `CLAUDE.md`'s "Where we are".
