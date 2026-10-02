import { useLocalSearchParams } from 'expo-router';

import { StationPageScreen } from '@/screens/station/page';

export default function StationPageRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <StationPageScreen page={page} />;
}
