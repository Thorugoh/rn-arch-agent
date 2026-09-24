import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { originLabel, type ConfirmRequest, type Confirmer } from '@todo/core';
import { useTheme } from './theme';

/**
 * The core Confirmer port, implemented as a bottom sheet. When an agent asks for a
 * destructive action, core awaits this promise until the user approves or declines.
 */
type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

let queue: Pending[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const confirmWithSheet: Confirmer = (req) =>
  new Promise<boolean>((resolve) => {
    queue = [...queue, { ...req, resolve }];
    emit();
  });

function answer(ok: boolean) {
  const [head, ...rest] = queue;
  if (!head) return;
  queue = rest;
  emit();
  head.resolve(ok);
}

export function ConfirmHost() {
  const t = useTheme();
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue[0],
  );

  return (
    <Modal visible={Boolean(current)} transparent animationType="slide" onRequestClose={() => answer(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.card }]} testID="confirm-sheet">
          <Text style={[styles.who, { color: t.agent }]}>{current ? originLabel(current.origin) : ''} wants to:</Text>
          <Text style={[styles.what, { color: t.text }]}>{current?.summary}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: t.subtle }]} onPress={() => answer(false)} testID="confirm-decline">
              <Text style={[styles.btnText, { color: t.text }]}>Decline</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: t.danger }]} onPress={() => answer(true)} testID="confirm-approve">
              <Text style={[styles.btnText, { color: '#fff' }]}>Approve</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8 },
  who: { fontSize: 14, fontWeight: '600' },
  what: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
});
