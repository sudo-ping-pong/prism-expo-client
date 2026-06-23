import { isPrismCommand } from '@sudo-ping-pong/prism-protocol';
import { dispatchPrismReduxCommand } from './middleware/redux';

export function handlePrismCommand(raw: unknown): void {
  if (!isPrismCommand(raw)) return;

  if (raw.command === 'dispatch') {
    dispatchPrismReduxCommand(raw.storeId, 'dispatch', raw.action);
    return;
  }

  if (raw.command === 'replace_state') {
    dispatchPrismReduxCommand(raw.storeId, 'replace_state', raw.state);
  }
}
