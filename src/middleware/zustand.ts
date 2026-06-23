import type { StatePayload } from '@prism/protocol';
import { captureStateEvent } from '../capture';

export interface PrismZustandOptions {
  storeId?: string;
}

type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean,
  actionName?: string,
) => void;

type StateCreator<T> = (
  set: SetState<T>,
  get: () => T,
  api: unknown,
) => T;

/**
 * Wrap a Zustand StateCreator to capture state mutations in Prism.
 */
export function prismZustandMiddleware<T>(storeIdOrOptions?: string | PrismZustandOptions) {
  const storeId =
    typeof storeIdOrOptions === 'string'
      ? storeIdOrOptions
      : (storeIdOrOptions?.storeId ?? 'default');

  return (creator: StateCreator<T>): StateCreator<T> => {
    return (set, get, api) => {
      const wrappedSet: SetState<T> = (partial, replace, actionName) => {
        const prevState = get();
        set(partial, replace);
        const nextState = get();

        const payload: StatePayload = {
          actionLabel: actionName ?? 'anonymous',
          payload: typeof partial === 'function' ? '(function)' : partial,
          prevState: structuredCloneSafe(prevState),
          nextState: structuredCloneSafe(nextState),
          storeId,
          source: 'zustand',
        };
        captureStateEvent(payload);
      };

      return creator(wrappedSet, get, api);
    };
  };
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}
