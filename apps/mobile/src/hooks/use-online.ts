import { useNetInfo } from '@react-native-community/netinfo';

import { DEV_OFFLINE } from '@/config';

/** False only when the phone says it has no connection. Not known yet (just launched) counts as online. */
export function useIsOnline(): boolean {
  const { isConnected } = useNetInfo();
  return !DEV_OFFLINE && isConnected !== false;
}
