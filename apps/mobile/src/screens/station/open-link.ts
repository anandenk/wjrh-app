import { Linking } from 'react-native';

/** Open a web, mailto: or tel: link. Failing quietly beats crashing on a device that can't open it. */
export function openLink(url: string): void {
  Linking.openURL(url).catch(() => {});
}
