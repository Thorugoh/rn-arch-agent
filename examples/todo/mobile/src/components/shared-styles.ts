import { StyleSheet } from 'react-native';

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowTitle: { flex: 1, fontSize: 16 },
  secondaryText: { fontSize: 13 },
});
