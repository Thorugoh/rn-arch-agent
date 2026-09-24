import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export function AddInput({ placeholder, onSubmit, testID }: { placeholder: string; onSubmit: (text: string) => void; testID?: string }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSubmit(value);
    setText('');
  };
  return (
    <View style={[styles.addRow, { backgroundColor: t.card, borderColor: t.border }]}>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        returnKeyType="done"
        submitBehavior="submit"
        style={[styles.input, { color: t.text }]}
      />
      <Pressable onPress={submit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add">
        <Text style={[styles.addBtn, { color: text.trim() ? t.accent : t.muted }]}>Add</Text>
      </Pressable>
    </View>
  );
}

export function Checkbox({ checked, onPress, label, testID }: { checked: boolean; onPress: () => void; label: string; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.box, { borderColor: checked ? t.accent : t.muted, backgroundColor: checked ? t.accent : 'transparent' }]}
    >
      {checked ? <Text style={styles.tick}>✓</Text> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.subtle }]}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          accessibilityRole="button"
          accessibilityState={{ selected: o === value }}
          style={[styles.segment, o === value && { backgroundColor: t.card }]}
        >
          <Text style={{ color: o === value ? t.text : t.muted, fontWeight: '600', textTransform: 'capitalize' }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[styles.empty, { color: t.muted }]}>{text}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  addBtn: { fontSize: 16, fontWeight: '600' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 14, fontWeight: '800' },
  segmented: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 3, borderRadius: 10 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  card: { marginHorizontal: 16, marginVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowTitle: { flex: 1, fontSize: 16 },
  meta: { fontSize: 13 },
});
