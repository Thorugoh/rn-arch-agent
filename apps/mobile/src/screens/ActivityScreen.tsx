import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useDispatch, useViewModel } from '../AppProvider';
import { Card, Empty, styles } from '../components/ui';
import { useTheme } from '../theme';
import { formatAgo } from './format';

export function ActivityScreen() {
  const vm = useViewModel({ name: 'activity' });
  const dispatch = useDispatch();
  const t = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <FlashList
        data={vm.entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={<Empty text="No changes yet." />}
        renderItem={({ item }) => (
          <Card style={item.byAgent ? { backgroundColor: t.agentBg, borderColor: t.agent } : undefined}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: item.undone ? t.muted : t.text, fontSize: 15, textDecorationLine: item.undone ? 'line-through' : 'none' }}>
                  {item.byAgent ? '✦ ' : ''}
                  {item.text}
                </Text>
                <Text style={[styles.meta, { color: t.muted }]}>
                  {formatAgo(item.at)}
                  {item.undone ? ' · undone' : ''}
                </Text>
              </View>
              {item.undoable ? (
                <Pressable onPress={() => dispatch('journal.undo', { entryId: item.id })} hitSlop={8} testID={`undo-${item.id}`}>
                  <Text style={{ color: t.accent, fontWeight: '600' }}>Undo</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
