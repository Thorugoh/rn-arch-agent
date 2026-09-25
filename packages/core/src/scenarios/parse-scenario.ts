import { isRunStep, type NumberedStep, type ScenarioStep } from './scenario-step';

/** One JSON step per line. Blank lines and lines starting with // or # are ignored. */
export function parseScenario(text: string): NumberedStep[] {
  return text.split('\n').flatMap((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) return [];
    return [{ line: index + 1, step: parseStep(line, index + 1) }];
  });
}

function parseStep(line: string, lineNumber: number): ScenarioStep {
  try {
    const step = JSON.parse(line) as ScenarioStep;
    if (!('run' in step) && !('expect' in step)) throw new Error('a step needs "run" or "expect"');
    return step;
  } catch (error) {
    throw new Error(`Line ${lineNumber}: ${error instanceof Error ? error.message : error}`, { cause: error });
  }
}

/** Every action a scenario touches, for coverage checks. */
export function actionsUsedBy(steps: NumberedStep[]): string[] {
  return steps.map(({ step }) => (isRunStep(step) ? step.run : step.expect));
}
