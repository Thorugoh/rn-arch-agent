import { Pressable, Text, View } from 'react-native';
import type { ActivityViewModel } from '@todo/domain';
import { Card } from '../../components/Card';
import { sharedStyles } from '../../components/shared-styles';
import { formatTimeAgo } from '../../format/dates';
import { useTheme } from '../../theme/theme';

type ActivityRowProps = { entry: ActivityViewModel['entries'][number]; onUndo: () => void };

/** One change: who did what, when, and an Undo button when it can be undone. */
export function ActivityRow({ entry, onUndo }: ActivityRowProps) {
  const theme = useTheme();
  const agentStyle = entry.byAgent ? { backgroundColor: theme.agentBackground, borderColor: theme.agent } : undefined;

  return (
    <Card style={agentStyle}>
      <View style={sharedStyles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: entry.undone ? theme.muted : theme.text, fontSize: 15, textDecorationLine: entry.undone ? 'line-through' : 'none' }}>
            {entry.byAgent ? '✦ ' : ''}
            {entry.text}
          </Text>
          <Text style={[sharedStyles.secondaryText, { color: theme.muted }]}>
            {formatTimeAgo(entry.at)}
            {entry.undone ? ' · undone' : ''}
          </Text>
        </View>
        {entry.undoable ? (
          <Pressable onPress={onUndo} hitSlop={8} testID={`undo-${entry.id}`}>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
