import type { PrismEnvelope } from '@prism/protocol';
import type { PrismTransport } from './transport';

export interface PrismTransportSink {
  send(envelope: PrismEnvelope): void;
}

let activeTransport: PrismTransportSink | null = null;

export function setActiveTransport(transport: PrismTransportSink | null): void {
  activeTransport = transport;
}

export function getActiveTransport(): PrismTransportSink | null {
  return activeTransport;
}

export function sendToPrism(envelope: PrismEnvelope): void {
  activeTransport?.send(envelope);
}
