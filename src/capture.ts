import { createEnvelope } from '@sudo-ping-pong/prism-protocol';
import type { LogLevel, LogPayload, NetworkPayload, StatePayload } from '@sudo-ping-pong/prism-protocol';
import { sendToPrism } from './transport-registry';

export function captureLogEvent(level: LogLevel, args: unknown[]): void {
  const payload: LogPayload = {
    level,
    args: serializeArgs(args),
    stack: level === 'error' ? captureStack() : undefined,
  };
  sendToPrism(createEnvelope('LOG', payload));
}

export function captureNetworkEvent(payload: NetworkPayload): void {
  sendToPrism(createEnvelope('NETWORK', payload));
}

export function captureStateEvent(payload: StatePayload): void {
  sendToPrism(createEnvelope('STATE', payload));
}

function serializeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return { name: arg.name, message: arg.message, stack: arg.stack };
    }
    try {
      JSON.stringify(arg);
      return arg;
    } catch {
      return String(arg);
    }
  });
}

function captureStack(): string | undefined {
  const err = new Error();
  const lines = err.stack?.split('\n').slice(2);
  return lines?.join('\n');
}
