import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/AppProvider';
import { ConfirmHost, confirmWithSheet } from './src/confirm';
import { Navigation } from './src/Navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider
        confirm={confirmWithSheet}
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        }
      >
        <Navigation />
        <ConfirmHost />
      </AppProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
