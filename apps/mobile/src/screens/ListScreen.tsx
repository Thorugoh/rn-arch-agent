import { useLayoutEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Filter } from '@todo/core';
import { useDispatch, useViewModel } from '../AppProvider';
import { AddInput, Card, Checkbox, Empty, Segmented, styles } from '../components/ui';
import type { StackParams } from '../Navigation';
import { useTheme } from '../theme';
import { formatDue } from './format';

const filters: Filter[] = ['all', 'open', 'done'];

export function ListScreen({ navigation, route }: NativeStackScreenProps<StackParams, 'list'>) {
  const { listId } = route.params;
  const vm = useViewModel({ name: 'list', params: { listId } });
  const dispatch = useDispatch();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'notFound' in vm ? '' : vm.title });
  }, [navigation, vm]);

  if ('notFound' in vm) return <Empty text="This list no longer exists." />;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <AddInput placeholder={`Add to ${vm.title}`} onSubmit={(title) => dispatch('todo.create', { listId, title })} testID="new-todo" />
      <Segmented value={vm.filter} options={filters} onChange={(filter) => dispatch('ui.setFilter', { filter })} />
      <FlashList
        data={vm.items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Empty text={vm.filter === 'done' ? 'Nothing done yet.' : 'All clear.'} />}
        renderItem={({ item }) => (
          <Card>
            <Pressable
              style={styles.row}
              onPress={() => dispatch('nav.push', { route: { name: 'todo', params: { todoId: item.id } } })}
              onLongPress={() =>
                Alert.alert(`Delete "${item.title}"?`, 'You can undo this from Activity.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => dispatch('todo.delete', { id: item.id }) },
                ])
              }
              testID={`todo-${item.id}`}
            >
              <Checkbox checked={item.done} label={item.title} testID={`check-${item.title}`} onPress={() => dispatch('todo.toggle', { id: item.id })} />
              <Text
                style={[styles.rowTitle, { color: item.done ? t.muted : t.text, textDecorationLine: item.done ? 'line-through' : 'none' }]}
              >
                {item.title}
              </Text>
              {item.due ? <Text style={[styles.meta, { color: t.muted }]}>{formatDue(item.due)}</Text> : null}
            </Pressable>
          </Card>
        )}
      />
      <Text style={{ color: t.muted, textAlign: 'center', padding: 12, paddingBottom: 12 + insets.bottom }}>
        {vm.counts.open} open · {vm.counts.done} done
      </Text>
    </View>
  );
}
