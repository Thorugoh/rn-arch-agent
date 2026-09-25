import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { dayFromToday, formatDueDate } from '../../format/dates';
import { useTheme } from '../../theme/theme';

type DueDateCardProps = { due: string | null; onChange: (due: string | null) => void };

/** Shows the due date with quick choices: Today, Tomorrow, Next week, Clear. */
export function DueDateCard({ due, onChange }: DueDateCardProps) {
  const theme = useTheme();
  const choices: Array<[label: string, value: string | null]> = [
    ['Today', dayFromToday(0)],
    ['Tomorrow', dayFromToday(1)],
    ['Next week', dayFromToday(7)],
    ...(due ? [['Clear', null] as [string, null]] : []),
  ];

  return (
    <Card>
      <View style={styles.content}>
        <Text style={{ color: theme.muted }}>Due: {due ? formatDueDate(due) : 'none'}</Text>
        <View style={styles.choices}>
          {choices.map(([label, value]) => (
            <Pressable key={label} onPress={() => onChange(value)} style={[styles.choice, { backgroundColor: theme.subtle }]}>
              <Text style={{ color: theme.text, fontWeight: '500' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 10 },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
});
