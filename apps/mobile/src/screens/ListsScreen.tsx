import { useLayoutEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useViewModel } from '../AppProvider';
import { AddInput, Card, styles } from '../components/ui';
import type { StackParams } from '../Navigation';
import { useTheme } from '../theme';

export function ListsScreen({ navigation }: NativeStackScreenProps<StackParams, 'lists'>) {
  const vm = useViewModel({ name: 'lists' });
  const dispatch = useDispatch();
  const t = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => dispatch('nav.push', { route: { name: 'activity' } })} hitSlop={8} testID="open-activity">
          <Text style={{ color: t.accent, fontSize: 16 }}>Activity</Text>
        </Pressable>
      ),
    });
  }, [navigation, dispatch, t]);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <AddInput placeholder="New list" onSubmit={(name) => dispatch('list.create', { name })} testID="new-list" />
      <FlashList
        data={vm.lists}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <Card>
            <Pressable
              style={styles.row}
              onPress={() => dispatch('nav.push', { route: { name: 'list', params: { listId: item.id } } })}
              accessibilityRole="button"
              testID={`list-${item.id}`}
            >
              <Text style={[styles.rowTitle, { color: t.text, fontWeight: '600' }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: t.muted }]}>
                {item.open} open{item.done ? ` · ${item.done} done` : ''}
              </Text>
              <Text style={{ color: t.muted, fontSize: 18 }}>›</Text>
            </Pressable>
          </Card>
        )}
      />
    </View>
  );
}
