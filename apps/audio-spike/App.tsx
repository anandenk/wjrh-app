// THROWAWAY audio spike: does expo-audio play the real WJRH stream, in the background,
// with lock-screen controls and interruption handling? Results go in
// docs/mobile-app/audio-spike.md. Not the real app.
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const STREAM_URL = 'https://internetstreamer.lafayette.edu/';
const BAD_URL = 'https://127.0.0.1:1/nothing.mp3'; // for the error / fallback test
const NOW_PLAYING_URL = 'https://nowplaying.wjrh.org';

// Spike-only: silence the player itself (we test with the Mac muted, e.g. in class).
// Playback state is checked from the status below, not by ear. Real app: remove this.
const SILENT = true;

type Track = { title: string; artist: string };

async function fetchTrack(): Promise<Track | null> {
  try {
    const res = await fetch(NOW_PLAYING_URL);
    const json = await res.json();
    const np = json.nowplaying ?? {};
    const dec = (s?: string) => (s ? decodeURIComponent(s) : '');
    return { title: dec(np.TITLE), artist: dec(np.ARTIST) };
  } catch {
    return null;
  }
}

export default function App() {
  const [uri, setUri] = useState(STREAM_URL);
  const player = useAudioPlayer({ uri }, { updateInterval: 1000, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const [track, setTrack] = useState<Track | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const lastLogged = useRef('');

  const note = (msg: string) => {
    console.log(`[spike] ${msg}`);
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 40));
  };
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix', // required for lock-screen controls
    }).then(() => note('audio mode set'));
  }, []);

  useEffect(() => {
    player.volume = SILENT ? 0 : 1;
  }, [player, uri]);

  // Log each change of playback state, not every tick.
  useEffect(() => {
    const key = `${status.playbackState}|${status.timeControlStatus}|${status.isBuffering}|${status.error}`;
    if (key !== lastLogged.current) {
      lastLogged.current = key;
      note(
        `state=${status.playbackState} control=${status.timeControlStatus} buffering=${status.isBuffering}` +
          (status.error ? ` ERROR=${status.error}` : ''),
      );
    }
  }, [status]);

  // Poll the real now-playing feed and mirror it onto the lock screen.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const t = await fetchTrack();
      if (alive && t) setTrack(t);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!track) return;
    player.updateLockScreenMetadata({ title: track.title, artist: track.artist, albumTitle: 'WJRH 104.9 FM' });
  }, [player, track]);

  const play = () => {
    player.play();
    player.setActiveForLockScreen(
      true,
      { title: track?.title ?? 'WJRH 104.9 FM', artist: track?.artist ?? 'Live', albumTitle: 'WJRH 104.9 FM' },
      { isLiveStream: true, showSeekBackward: false, showSeekForward: false },
    );
    note('play() + lock screen active');
  };
  const pause = () => {
    player.pause();
    note('pause()');
  };

  // Unattended test sequence (no taps needed): play, heartbeat every 5 s (also in the
  // background), then bad URL (error state) at +100 s and recovery at +115 s.
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    const t0 = Date.now();
    const timers = [
      setTimeout(() => playRef.current(), 3000),
      setTimeout(() => {
        note('AUTO: switching to BAD url');
        setUri(BAD_URL);
      }, 100000),
      setTimeout(() => {
        note('AUTO: back to real url + play');
        setUri(STREAM_URL);
        setTimeout(() => playRef.current(), 2000);
      }, 115000),
    ];
    const hb = setInterval(() => {
      const st = statusRef.current;
      console.log(
        `[spike] heartbeat +${Math.round((Date.now() - t0) / 1000)}s ` +
          JSON.stringify({
            playing: st.playing,
            state: st.playbackState,
            control: st.timeControlStatus,
            buffering: st.isBuffering,
            time: Number(st.currentTime.toFixed(1)),
            err: st.error,
          }),
      );
    }, 5000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(hb);
    };
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>WJRH audio spike (expo-audio)</Text>
      <Text style={styles.line}>source: {uri === STREAM_URL ? 'real stream' : 'BAD url'}</Text>
      <Text style={styles.line}>
        loaded={String(status.isLoaded)} playing={String(status.playing)} buffering={String(status.isBuffering)}
      </Text>
      <Text style={styles.line}>
        state={status.playbackState} control={status.timeControlStatus}
      </Text>
      <Text style={styles.line}>
        time={status.currentTime.toFixed(1)}s live={String(status.isLive)} volume={player.volume}
      </Text>
      {status.error ? <Text style={[styles.line, styles.err]}>error: {status.error}</Text> : null}
      <Text style={styles.line}>
        track: {track ? `${track.title} — ${track.artist}` : '(loading)'}
      </Text>
      <View style={styles.row}>
        <Button title="Play" onPress={play} />
        <Button title="Pause" onPress={pause} />
        <Button
          title={uri === STREAM_URL ? 'Use bad URL' : 'Use real URL'}
          onPress={() => setUri(uri === STREAM_URL ? BAD_URL : STREAM_URL)}
        />
      </View>
      <ScrollView style={styles.log}>
        {log.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 70, paddingHorizontal: 16, backgroundColor: '#fff' },
  h1: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  line: { fontSize: 14, marginBottom: 4 },
  err: { color: '#b00020' },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
  log: { flex: 1, backgroundColor: '#f3f3f3', padding: 8 },
  logLine: { fontFamily: 'Menlo', fontSize: 11, marginBottom: 2 },
});
