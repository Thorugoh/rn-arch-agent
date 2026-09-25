import { Pressable, Text } from 'react-native';
import type { ListsViewModel } from '@todo/domain';
import { Card } from '../../components/Card';
import { sharedStyles } from '../../components/shared-styles';
import { useTheme } from '../../theme/theme';

type ListRowProps = { list: ListsViewModel['lists'][number]; onOpen: () => void };

export function ListRow({ list, onOpen }: ListRowProps) {
  const theme = useTheme();
  const counts = `${list.open} open${list.done ? ` · ${list.done} done` : ''}`;
  return (
    <Card>
      <Pressable style={sharedStyles.row} onPress={onOpen} accessibilityRole="button" testID={`list-${list.id}`}>
        <Text style={[sharedStyles.rowTitle, { color: theme.text, fontWeight: '600' }]}>{list.name}</Text>
        <Text style={[sharedStyles.secondaryText, { color: theme.muted }]}>{counts}</Text>
        <Text style={{ color: theme.muted, fontSize: 18 }}>›</Text>
      </Pressable>
    </Card>
  );
}
