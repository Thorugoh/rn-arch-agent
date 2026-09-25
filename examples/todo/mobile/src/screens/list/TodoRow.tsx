import { Alert, Pressable, Text } from 'react-native';
import type { ListViewModel } from '@todo/domain';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { sharedStyles } from '../../components/shared-styles';
import { formatDueDate } from '../../format/dates';
import { useTheme } from '../../theme/theme';

type TodoItem = Extract<ListViewModel, { items: unknown }>['items'][number];

type TodoRowProps = { todo: TodoItem; onOpen: () => void; onToggle: () => void; onDelete: () => void };

export function TodoRow({ todo, onOpen, onToggle, onDelete }: TodoRowProps) {
  const theme = useTheme();
  const confirmDelete = () =>
    Alert.alert(`Delete "${todo.title}"?`, 'You can undo this from Activity.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Card>
      <Pressable style={sharedStyles.row} onPress={onOpen} onLongPress={confirmDelete} testID={`todo-${todo.id}`}>
        <Checkbox checked={todo.done} label={todo.title} testID={`check-${todo.title}`} onPress={onToggle} />
        <Text
          style={[
            sharedStyles.rowTitle,
            { color: todo.done ? theme.muted : theme.text, textDecorationLine: todo.done ? 'line-through' : 'none' },
          ]}
        >
          {todo.title}
        </Text>
        {todo.due ? <Text style={[sharedStyles.secondaryText, { color: theme.muted }]}>{formatDueDate(todo.due)}</Text> : null}
      </Pressable>
    </Card>
  );
}
