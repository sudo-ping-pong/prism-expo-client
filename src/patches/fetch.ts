import type { NetworkPayload } from '@prism/protocol';
import { captureNetworkEvent } from '../capture';

export function headersToRecord(
  headers: Headers | Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  return { ...headers };
}

export async function bodyToString(body: unknown): Promise<string | undefined> {
  if (body == null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value, key) => {
      parts.push(`${key}=${String(value)}`);
    });
    return parts.join('&');
  }
  if (body instanceof URLSearchParams) return body.toString();
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

export function installFetchPatch(): () => void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const start = Date.now();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    let requestHeaders: Record<string, string> = {};
    let requestBody: string | undefined;

    if (input instanceof Request) {
      requestHeaders = headersToRecord(input.headers);
    }
    if (init?.headers) {
      requestHeaders = { ...requestHeaders, ...headersToRecord(init.headers as Headers) };
    }
    requestBody = await bodyToString(init?.body);

    let response: Response;
    let error: unknown;

    try {
      response = await originalFetch(input, init);
    } catch (err) {
      error = err;
      const payload: NetworkPayload = {
        method: method.toUpperCase(),
        url,
        status: 0,
        statusText: 'Network Error',
        requestHeaders,
        responseHeaders: {},
        requestBody,
        durationMs: Date.now() - start,
        initiator: 'fetch',
      };
      captureNetworkEvent(payload);
      throw err;
    }

    const cloned = response.clone();
    let responseBody: string | undefined;
    try {
      responseBody = await cloned.text();
    } catch {
      responseBody = undefined;
    }

    const payload: NetworkPayload = {
      method: method.toUpperCase(),
      url,
      status: response.status,
      statusText: response.statusText,
      requestHeaders,
      responseHeaders: headersToRecord(response.headers),
      requestBody,
      responseBody,
      durationMs: Date.now() - start,
      initiator: 'fetch',
    };

    captureNetworkEvent(payload);
    return response;
  } as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}
