import { Alert } from 'react-native';
import type { DispatchFailure } from '@agentic/core';
import { useDispatch } from '@agentic/react-native';

const showFailure = (failure: DispatchFailure) => Alert.alert('Could not do that', failure.message);

/** Dispatch for taps (origin "user"); failures show an alert. */
export function useUserDispatch() {
  return useDispatch(showFailure);
}
