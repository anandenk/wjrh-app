import { setAudioModeAsync } from 'expo-audio';

let configured: Promise<void> | null = null;

/**
 * Configure the audio session once: play with the ring switch off, keep playing in the background,
 * and take over audio focus ("doNotMix" is required for lock-screen controls).
 */
export function configureAudioSession(): Promise<void> {
  configured ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch((e) => {
    configured = null; // allow a retry on the next call
    throw e;
  });
  return configured;
}
