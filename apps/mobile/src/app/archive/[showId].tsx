import { useLocalSearchParams } from 'expo-router';

import { ArchiveDetailScreen } from '@/screens/archive/detail';

export default function ArchiveDetailRoute() {
  const { showId } = useLocalSearchParams<{ showId: string }>();
  return <ArchiveDetailScreen showId={showId} />;
}
