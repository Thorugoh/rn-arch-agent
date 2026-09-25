import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { sharedStyles } from '../../components/shared-styles';
import { useTheme } from '../../theme/theme';

type TitleCardProps = { title: string; done: boolean; onToggle: () => void; onRename: (title: string) => void };

/** The todo's checkbox and editable title. */
export function TitleCard({ title, done, onToggle, onRename }: TitleCardProps) {
  const theme = useTheme();
  // null = not editing: the field shows the live title (e.g. when an agent renames the todo).
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    const next = draft?.trim();
    if (next && next !== title) onRename(next);
    setDraft(null);
  };

  return (
    <Card>
      <View style={sharedStyles.row}>
        <Checkbox checked={done} label={title} onPress={onToggle} />
        <TextInput
          value={draft ?? title}
          onChangeText={setDraft}
          onEndEditing={save}
          onSubmitEditing={save}
          style={[sharedStyles.rowTitle, { color: theme.text, fontSize: 20, fontWeight: '600' }]}
          testID="todo-title"
        />
      </View>
    </Card>
  );
}
