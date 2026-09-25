import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/theme';

export function EmptyState({ message }: { message: string }) {
  const theme = useTheme();
  return <Text style={[styles.message, { color: theme.muted }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  message: { textAlign: 'center', marginTop: 48, fontSize: 15 },
});
