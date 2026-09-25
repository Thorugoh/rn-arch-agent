import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/theme';

type CheckboxProps = { checked: boolean; label: string; onPress: () => void; testID?: string };

export function Checkbox({ checked, label, onPress, testID }: CheckboxProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.box, { borderColor: checked ? theme.accent : theme.muted, backgroundColor: checked ? theme.accent : 'transparent' }]}
    >
      {checked ? <Text style={styles.tick}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
