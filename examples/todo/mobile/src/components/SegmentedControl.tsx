import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

type SegmentedControlProps<TOption extends string> = {
  value: TOption;
  options: TOption[];
  onChange: (option: TOption) => void;
};

export function SegmentedControl<TOption extends string>({ value, options, onChange }: SegmentedControlProps<TOption>) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.subtle }]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: theme.card }]}
          >
            <Text style={[styles.label, { color: selected ? theme.text : theme.muted }]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 3, borderRadius: 10 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  label: { fontWeight: '600', textTransform: 'capitalize' },
});
