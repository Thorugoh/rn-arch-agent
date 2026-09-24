import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Device from 'expo-device';
import { captureScreen } from 'react-native-view-shot';
import { DEFAULT_RELAY_PORT, startAppBridge, type BridgeStatus } from '@todo/bridge';
import type { App } from '@todo/core';

/**
 * Remote mode, dev builds only: dial out to the relay (`todo serve`) so the CLI, scenarios and
 * agents can drive this app through the same actions the UI uses.
 *
 * Config (all optional): EXPO_PUBLIC_TODO_RELAY_URL, EXPO_PUBLIC_TODO_RELAY_TOKEN, EXPO_PUBLIC_TODO_DEVICE.
 * Defaults: the iOS simulator reaches the Mac at 127.0.0.1, the Android emulator at 10.0.2.2.
 */
const relayUrl =
  process.env.EXPO_PUBLIC_TODO_RELAY_URL ??
  `ws://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${DEFAULT_RELAY_PORT}`;

const deviceName = process.env.EXPO_PUBLIC_TODO_DEVICE ?? `${Platform.OS}-${Device.isDevice ? 'device' : 'sim'}`;

export function useDevBridge(app: App | null): BridgeStatus | null {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  useEffect(() => {
    if (!__DEV__ || !app) return;
    const bridge = startAppBridge(app, {
      url: relayUrl,
      name: deviceName,
      platform: Platform.OS,
      token: process.env.EXPO_PUBLIC_TODO_RELAY_TOKEN,
      screenshot: () => captureScreen({ format: 'png', result: 'base64' }),
      onStatus: setStatus,
    });
    return bridge.stop;
  }, [app]);
  return status;
}

/** A small pill so it's obvious when the app can be driven remotely. */
export function DevBridgeBadge({ status }: { status: BridgeStatus | null }) {
  if (status !== 'open') return null;
  return (
    <View pointerEvents="none" style={styles.badge} testID="dev-bridge-badge">
      <Text style={styles.text}>● remote</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 12,
    bottom: 40,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(139,63,217,0.9)',
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
