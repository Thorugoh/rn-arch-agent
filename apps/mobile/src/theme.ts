import { useColorScheme } from 'react-native';

const light = {
  bg: '#f4f4f6',
  card: '#ffffff',
  text: '#15151a',
  muted: '#6b6b76',
  subtle: '#e8e8ee',
  border: '#dedee6',
  accent: '#3b5bdb',
  agent: '#8b3fd9',
  agentBg: '#f3eafd',
  danger: '#d6336c',
};

const dark: typeof light = {
  bg: '#0e0e11',
  card: '#1a1a20',
  text: '#f1f1f4',
  muted: '#9a9aa6',
  subtle: '#2a2a33',
  border: '#2c2c35',
  accent: '#748ffc',
  agent: '#c297f5',
  agentBg: '#2a1f3a',
  danger: '#f06595',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
