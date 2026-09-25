import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Mirrors the todo domain's routes. The runtime owns navigation; React Navigation renders it. */
export type StackParams = {
  lists: undefined;
  list: { listId: string };
  todo: { todoId: string };
  activity: undefined;
};

export type ScreenProps<TName extends keyof StackParams> = NativeStackScreenProps<StackParams, TName>;
