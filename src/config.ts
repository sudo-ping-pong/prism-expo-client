import { PRISM_DEFAULT_PORT } from '@sudo-ping-pong/prism-protocol';
import type { PrismTransportError } from './transport';

export interface PrismLocalConfigOptions {
  port?: number;
  network?: boolean;
  logs?: boolean;
  forceEnable?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: PrismTransportError) => void;
}

/** Build SDK config for a host (defaults to port 8080). */
export function createPrismLocalConfig(
  host: string,
  overrides?: PrismLocalConfigOptions,
) {
  return {
    host,
    port: overrides?.port ?? PRISM_DEFAULT_PORT,
    network: overrides?.network,
    logs: overrides?.logs,
    forceEnable: overrides?.forceEnable,
    onConnect: overrides?.onConnect,
    onDisconnect: overrides?.onDisconnect,
    onError: overrides?.onError,
  };
}
