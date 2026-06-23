import type { PrismEnvelope } from '@prism/protocol';
import { PRISM_MAX_BUFFER_SIZE } from '@prism/protocol';

export class EventBuffer {
  private buffer: PrismEnvelope[] = [];

  push(envelope: PrismEnvelope): void {
    if (this.buffer.length >= PRISM_MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(envelope);
  }

  drain(): PrismEnvelope[] {
    const items = [...this.buffer];
    this.buffer = [];
    return items;
  }

  get size(): number {
    return this.buffer.length;
  }
}
