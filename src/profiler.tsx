import type { ReactNode } from 'react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { createEnvelope } from '@prism/protocol';
import type { PerformancePayload } from '@prism/protocol';
import { sendToPrism } from './transport-registry';

export interface PrismProfilerProps {
  /** Component label shown in the performance timeline */
  id: string;
  children: ReactNode;
}

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  const payload: PerformancePayload = {
    type: 'render',
    componentId: id,
    phase: phase === 'mount' ? 'mount' : phase === 'update' ? 'update' : 'nested-update',
    actualDurationMs: actualDuration,
    baseDurationMs: baseDuration,
  };
  sendToPrism(createEnvelope('PERFORMANCE', payload));
};

/** Wrap a subtree to capture React render timings in Prism DevTools. */
export function PrismProfiler({ id, children }: PrismProfilerProps) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
