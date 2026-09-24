import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDispatch, useViewModel } from '../AppProvider';
import { Card, Checkbox, Empty, styles } from '../components/ui';
import type { StackParams } from '../Navigation';
import { useTheme } from '../theme';
import { dayAt, formatDue } from './format';

export function TodoScreen({ route }: NativeStackScreenProps<StackParams, 'todo'>) {
  const { todoId } = route.params;
  const vm = useViewModel({ name: 'todo', params: { todoId } });
  const dispatch = useDispatch();
  const t = useTheme();
  // null = not editing, so the field shows the live title (e.g. when an agent renames it).
  const [draft, setDraft] = useState<string | null>(null);

  if ('notFound' in vm) return <Empty text="This todo no longer exists." />;

  const saveTitle = () => {
    const next = draft?.trim();
    if (next && next !== vm.title) void dispatch('todo.update', { id: vm.id, title: next });
    setDraft(null);
  };

  const chip = (label: string, due: string | null) => (
    <Pressable
      key={label}
      onPress={() => dispatch('todo.update', { id: vm.id, due })}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.subtle }}
    >
      <Text style={{ color: t.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={[styles.screen, { backgroundColor: t.bg }]} contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
      <Card>
        <View style={styles.row}>
          <Checkbox checked={vm.done} label={vm.title} onPress={() => dispatch('todo.toggle', { id: vm.id })} />
          <TextInput
            value={draft ?? vm.title}
            onChangeText={setDraft}
            onEndEditing={saveTitle}
            onSubmitEditing={saveTitle}
            style={[styles.rowTitle, { color: t.text, fontSize: 20, fontWeight: '600' }]}
            testID="todo-title"
          />
        </View>
      </Card>
      <Card>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={{ color: t.muted }}>Due: {vm.due ? formatDue(vm.due) : 'none'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {chip('Today', dayAt(0))}
            {chip('Tomorrow', dayAt(1))}
            {chip('Next week', dayAt(7))}
            {vm.due ? chip('Clear', null) : null}
          </View>
        </View>
      </Card>
      <Text style={{ color: t.muted, marginHorizontal: 16 }}>In {vm.list.name}</Text>
      <Pressable onPress={() => dispatch('todo.delete', { id: vm.id })} style={{ alignSelf: 'center', padding: 16 }} testID="delete-todo">
        <Text style={{ color: t.danger, fontSize: 16, fontWeight: '600' }}>Delete todo</Text>
      </Pressable>
    </ScrollView>
  );
}
