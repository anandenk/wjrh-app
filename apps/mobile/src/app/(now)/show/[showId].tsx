import { useLocalSearchParams } from 'expo-router';

import { ShowScreen } from '@/screens/show';

// The same show page as /schedule/[showId], opened from the Now tab so "back" returns to Now.
export default function NowShowRoute() {
  const { showId } = useLocalSearchParams<{ showId: string }>();
  return <ShowScreen showId={showId} backLabel="NOW" />;
}
