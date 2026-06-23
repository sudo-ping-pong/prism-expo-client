import type { Store, Action, Reducer } from 'redux';
import type { StatePayload } from '@sudo-ping-pong/prism-protocol';
import { captureStateEvent } from '../capture';

/** Dispatched by Prism to replace the entire Redux state (time-travel jump). */
export const PRISM_REPLACE_STATE = '@@prism/REPLACE_STATE';

export interface PrismReplaceStateAction<S = unknown> extends Action<typeof PRISM_REPLACE_STATE> {
  payload: S;
}

export interface PrismReduxOptions {
  storeId?: string;
  /** Redux action types to skip, e.g. ['@@INIT'] */
  ignoredActions?: string[];
}

const reduxStores = new Map<string, Store>();

export function registerPrismReduxStore(store: Store, storeId = 'redux'): () => void {
  reduxStores.set(storeId, store);
  return () => reduxStores.delete(storeId);
}

export function getPrismReduxStore(storeId: string): Store | undefined {
  return reduxStores.get(storeId);
}

/**
 * Wrap a root reducer so Prism can jump to a historical state snapshot.
 *
 * ```ts
 * const store = configureStore({
 *   reducer: withPrismStateReplay(rootReducer),
 *   middleware: (gDM) => gDM().concat(prismReduxMiddleware('app')),
 * });
 * registerPrismReduxStore(store, 'app');
 * ```
 */
export function withPrismStateReplay<S>(reducer: Reducer<S>): Reducer<S> {
  return (state, action) => {
    if (action.type === PRISM_REPLACE_STATE) {
      return (action as unknown as PrismReplaceStateAction<S>).payload;
    }
    return reducer(state, action);
  };
}

const DEFAULT_IGNORED = ['@@INIT', '@@redux/INIT'];

export function prismReduxMiddleware(
  storeIdOrOptions?: string | PrismReduxOptions,
): import('redux').Middleware {
  const opts: PrismReduxOptions =
    typeof storeIdOrOptions === 'string'
      ? { storeId: storeIdOrOptions }
      : { storeId: 'redux', ...storeIdOrOptions };

  const storeId = opts.storeId ?? 'redux';
  const ignored = new Set([...DEFAULT_IGNORED, ...(opts.ignoredActions ?? [])]);

  return (storeApi) => {
    reduxStores.set(storeId, storeApi as unknown as Store);

    return (next) => (action) => {
      const prevState = storeApi.getState();
      const result = next(action);
      const nextState = storeApi.getState();

      const actionType = (action as Action).type ?? 'unknown';
      if (ignored.has(actionType) || actionType === PRISM_REPLACE_STATE) {
        return result;
      }

      const payload: StatePayload = {
        actionLabel: actionType,
        payload: serializeAction(action),
        prevState: cloneState(prevState),
        nextState: cloneState(nextState),
        storeId,
        source: 'redux',
      };

      captureStateEvent(payload);
      return result;
    };
  };
}

export function dispatchPrismReduxCommand(
  storeId: string,
  command: 'dispatch' | 'replace_state',
  data: unknown,
): boolean {
  const store = reduxStores.get(storeId);
  if (!store) return false;

  if (command === 'dispatch') {
    store.dispatch(data as Action);
    return true;
  }

  store.dispatch({
    type: PRISM_REPLACE_STATE,
    payload: data,
  } as unknown as Action);
  return true;
}

function serializeAction(action: unknown): unknown {
  if (typeof action !== 'object' || action === null) return action;
  try {
    JSON.stringify(action);
    return action;
  } catch {
    return { type: (action as Action).type, note: '(non-serializable action)' };
  }
}

function cloneState<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}
