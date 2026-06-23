import { PrismTransport } from './transport';
import { installFetchPatch } from './patches/fetch';
import { installXhrPatch } from './patches/xhr';
import { installAxiosPatch } from './patches/axios';
import { installConsolePatch } from './patches/console';
import { setActiveTransport } from './transport-registry';
import { createPrismLocalConfig } from './config';
import type { PrismTransportError } from './transport';

export interface PrismConfig {
  /** Machine running Prism (LAN IP or localhost) */
  host: string;
  /** WebSocket port (default 8080) */
  port?: number;
  /** Intercept fetch (default true) */
  network?: boolean;
  /** Intercept console.log/warn/error (default true) */
  logs?: boolean;
  /** Force enable in production (default: only __DEV__) */
  forceEnable?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: PrismTransportError) => void;
}

let initialized = false;
let transport: PrismTransport | null = null;
let patchesInstalled = false;
let unsubs: Array<() => void> = [];

function startTransport(config: PrismConfig): void {
  transport?.disconnect();

  transport = new PrismTransport({
    host: config.host,
    port: config.port ?? 8080,
    onConnect: config.onConnect ?? (() => logDev('[Prism] Connected to DevTools')),
    onDisconnect: config.onDisconnect ?? (() => logDev('[Prism] Disconnected — retrying…')),
    onError:
      config.onError ??
      ((error) => {
        if (error.type === 'auth') {
          console.warn(`[Prism] ${error.message}`);
        } else if (error.type === 'network') {
          logDev(`[Prism] ${error.message}`);
        } else {
          console.warn(`[Prism] ${error.message}`);
        }
      }),
  });

  setActiveTransport(transport);
  transport.resetAuthFailure();
  transport.connect();
}

function installPatches(config: PrismConfig): void {
  if (patchesInstalled || !transport) return;

  if (config.network !== false) {
    unsubs.push(installFetchPatch());
    unsubs.push(installXhrPatch());
    unsubs.push(installAxiosPatch());
  }
  if (config.logs !== false) {
    unsubs.push(installConsolePatch());
  }
  patchesInstalled = true;
}

export function initPrism(config: PrismConfig): void {
  const isDev =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

  if (!config.forceEnable && !isDev) return;
  if (initialized) return;

  initialized = true;
  startTransport(config);
  installPatches(config);
}

/** One-liner init — pass your machine's LAN IP (or Expo dev host). */
export function initPrismLocal(host: string, overrides?: Partial<PrismConfig>): void {
  initPrism(createPrismLocalConfig(host, overrides));
}

/** Reconnect with updated host/port without reinstalling patches. */
export function reconnectPrism(config: PrismConfig): void {
  const isDev =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

  if (!config.forceEnable && !isDev) return;

  if (!initialized) {
    initPrism(config);
    return;
  }

  startTransport(config);
}

export function destroyPrism(): void {
  transport?.disconnect();
  setActiveTransport(null);
  transport = null;
  initialized = false;

  for (const unsub of unsubs) unsub();
  unsubs = [];
  patchesInstalled = false;
}

export function getPrismTransport(): PrismTransport | null {
  return transport;
}

export { PrismTransport } from './transport';
export type { TransportOptions, PrismTransportError } from './transport';

export { prismZustandMiddleware } from './middleware/zustand';
export type { PrismZustandOptions } from './middleware/zustand';
export { PrismProfiler } from './profiler';
export type { PrismProfilerProps } from './profiler';
export {
  prismReduxMiddleware,
  withPrismStateReplay,
  registerPrismReduxStore,
  PRISM_REPLACE_STATE,
} from './middleware/redux';
export type { PrismReduxOptions, PrismReplaceStateAction } from './middleware/redux';
export { parsePrismConnectUri } from '@prism/protocol';
export type { PrismConnectConfig, PrismCommand, StateSource } from '@prism/protocol';
export { installAxiosPatch } from './patches/axios';
export { createPrismLocalConfig } from './config';
export type { PrismLocalConfigOptions } from './config';

declare const __DEV__: boolean | undefined;

function logDev(message: string): void {
  if (typeof __DEV__ !== 'undefined' ? __DEV__ : true) {
    console.log(message);
  }
}
