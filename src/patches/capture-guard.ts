let depth = 0;

/** Suppress fetch/XHR patches while axios handles capture (avoids duplicate events). */
export function runWithoutNetworkCapture<T>(fn: () => T): T {
  depth += 1;
  try {
    return fn();
  } finally {
    depth -= 1;
  }
}

export async function runWithoutNetworkCaptureAsync<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  try {
    return await fn();
  } finally {
    depth -= 1;
  }
}

export function shouldSkipNetworkCapture(): boolean {
  return depth > 0;
}
