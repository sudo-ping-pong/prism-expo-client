import type { LogLevel } from '@prism/protocol';
import { captureLogEvent } from '../capture';

type ConsoleFn = (...args: unknown[]) => void;

const LEVELS: LogLevel[] = ['log', 'warn', 'error'];

export function installConsolePatch(): () => void {
  const originals = new Map<LogLevel, ConsoleFn>();

  for (const level of LEVELS) {
    const original = console[level].bind(console) as ConsoleFn;
    originals.set(level, original);

    console[level] = (...args: unknown[]) => {
      original(...args);
      captureLogEvent(level, args);
    };
  }

  return () => {
    for (const level of LEVELS) {
      const original = originals.get(level);
      if (original) console[level] = original as typeof console.log;
    }
  };
}
