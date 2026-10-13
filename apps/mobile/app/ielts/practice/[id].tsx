import { useLocalSearchParams, Stack } from 'expo-router';
import { useApi } from '../../../src/lib/hooks';
import { ErrorText, Loading, Screen } from '../../../src/components/ui';
import { IeltsPlayer } from '../../../src/components/IeltsPlayer';

export default function Practice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useApi<any>(`/ielts/attempts/${id}`);
  return (
    <Screen>
      <Stack.Screen options={{ title: data?.set.skill === 'listening' ? 'Listening' : 'Reading' }} />
      <ErrorText error={error} />
      {loading ? <Loading /> : data && <IeltsPlayer attempt={data} />}
    </Screen>
  );
}
