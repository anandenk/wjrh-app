import { useLocalSearchParams } from 'expo-router';

import { ShowScreen } from '@/screens/show';

export default function ShowRoute() {
  const { showId } = useLocalSearchParams<{ showId: string }>();
  return <ShowScreen showId={showId} />;
}
