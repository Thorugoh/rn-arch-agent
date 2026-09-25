import type { CliConfig } from '@agentic/cli';
import { todoApp } from '@todo/domain';

/** The whole todo CLI is this config: every command comes from @agentic/cli. */
export const todoCli: CliConfig = { name: 'todo', app: todoApp };
