import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/theme';

type TextEntryProps = { placeholder: string; onSubmit: (text: string) => void; testID?: string };

/** A text field with an Add button; clears itself after submitting. */
export function TextEntry({ placeholder, onSubmit, testID }: TextEntryProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  const submit = () => {
    if (!hasText) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        returnKeyType="done"
        submitBehavior="submit"
        style={[styles.input, { color: theme.text }]}
      />
      <Pressable onPress={submit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add">
        <Text style={[styles.button, { color: hasText ? theme.accent : theme.muted }]}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  button: { fontSize: 16, fontWeight: '600' },
});
