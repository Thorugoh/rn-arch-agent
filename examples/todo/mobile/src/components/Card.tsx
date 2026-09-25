import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
