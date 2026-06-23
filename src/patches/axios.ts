import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  AxiosStatic,
  InternalAxiosRequestConfig,
} from 'axios';
import type { NetworkPayload } from '@prism/protocol';
import { captureNetworkEvent } from '../capture';
import { runWithoutNetworkCaptureAsync, shouldSkipNetworkCapture } from './capture-guard';
import { headersToRecord } from './fetch';

interface RequestMeta {
  start: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
}

const patchedInstances = new WeakSet<AxiosInstance>();
const requestMeta = new WeakMap<InternalAxiosRequestConfig, RequestMeta>();

function serializeBody(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') return data;
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return data.toString();
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const parts: string[] = [];
    data.forEach((value, key) => parts.push(`${key}=${String(value)}`));
    return parts.join('&');
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function flattenHeaders(headers: InternalAxiosRequestConfig['headers']): Record<string, string> {
  if (!headers) return {};
  if (typeof (headers as { toJSON?: () => Record<string, string> }).toJSON === 'function') {
    return (headers as { toJSON: () => Record<string, string> }).toJSON();
  }
  return headersToRecord(headers as Record<string, string>);
}

function resolveUrl(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = config.baseURL ?? '';
  if (!base) return url;
  return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function captureFromMeta(
  meta: RequestMeta,
  status: number,
  statusText: string,
  responseHeaders: Record<string, string>,
  responseBody?: string,
): void {
  const payload: NetworkPayload = {
    method: meta.method,
    url: meta.url,
    status,
    statusText,
    requestHeaders: meta.requestHeaders,
    responseHeaders,
    requestBody: meta.requestBody,
    responseBody,
    durationMs: Date.now() - meta.start,
    initiator: 'axios',
  };
  captureNetworkEvent(payload);
}

function captureFromResponse(response: AxiosResponse): void {
  const meta = requestMeta.get(response.config);
  if (!meta) return;

  const responseHeaders = flattenHeaders(response.headers as InternalAxiosRequestConfig['headers']);
  const responseBody = serializeBody(response.data);

  captureFromMeta(meta, response.status, response.statusText, responseHeaders, responseBody);
  requestMeta.delete(response.config);
}

function captureFromError(error: AxiosError): void {
  const config = error.config;
  if (!config) return;

  const meta = requestMeta.get(config);
  if (!meta) return;

  if (error.response) {
    const responseHeaders = flattenHeaders(
      error.response.headers as InternalAxiosRequestConfig['headers'],
    );
    captureFromMeta(
      meta,
      error.response.status,
      error.response.statusText,
      responseHeaders,
      serializeBody(error.response.data),
    );
  } else {
    captureFromMeta(meta, 0, error.message || 'Network Error', {}, undefined);
  }

  requestMeta.delete(config);
}

function patchAxiosInstance(instance: AxiosInstance): void {
  if (patchedInstances.has(instance)) return;
  patchedInstances.add(instance);

  instance.interceptors.request.use((config) => {
    requestMeta.set(config, {
      start: Date.now(),
      method: (config.method ?? 'get').toUpperCase(),
      url: resolveUrl(config),
      requestHeaders: flattenHeaders(config.headers),
      requestBody: serializeBody(config.data),
    });
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      captureFromResponse(response);
      return response;
    },
    (error: AxiosError) => {
      captureFromError(error);
      return Promise.reject(error);
    },
  );

  const originalRequest = instance.request.bind(instance);
  instance.request = ((config) =>
    runWithoutNetworkCaptureAsync(() => originalRequest(config))) as typeof instance.request;
}

function resolveAxiosModule(axiosModule?: AxiosStatic): AxiosStatic | null {
  if (axiosModule) return axiosModule;

  const req = (globalThis as { require?: (id: string) => unknown }).require;
  if (!req) return null;

  try {
    const mod = req('axios') as AxiosStatic | { default: AxiosStatic };
    return ('default' in mod ? mod.default : mod) as AxiosStatic;
  } catch {
    return null;
  }
}

export function installAxiosPatch(axiosModule?: AxiosStatic): () => void {
  const axios = resolveAxiosModule(axiosModule);
  if (!axios) return () => {};

  patchAxiosInstance(axios);

  const originalCreate = axios.create.bind(axios);
  axios.create = ((...args: Parameters<AxiosStatic['create']>) => {
    const instance = originalCreate(...args);
    patchAxiosInstance(instance);
    return instance;
  }) as AxiosStatic['create'];

  return () => {
    // Axios has no public API to remove interceptors from the default instance;
    // patch is idempotent per instance for the app lifetime.
  };
}

export function isAxiosNetworkCaptureActive(): boolean {
  return shouldSkipNetworkCapture();
}
