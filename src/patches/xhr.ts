import type { NetworkPayload } from '@prism/protocol';
import { captureNetworkEvent } from '../capture';

type XHROpen = typeof XMLHttpRequest.prototype.open;
type XHRSend = typeof XMLHttpRequest.prototype.send;
type XHRSetHeader = typeof XMLHttpRequest.prototype.setRequestHeader;

export function installXhrPatch(): () => void {
  const originalOpen = XMLHttpRequest.prototype.open as XHROpen;
  const originalSend = XMLHttpRequest.prototype.send as XHRSend;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader as XHRSetHeader;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
  (this as XMLHttpRequest & { _prism?: { method: string; url: string; headers: Record<string, string>; start: number } })._prism = {
      method: method.toUpperCase(),
      url: typeof url === 'string' ? url : url.href,
      headers: {},
      start: 0,
    };
    return originalOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
    const prism = (this as XMLHttpRequest & { _prism?: { headers: Record<string, string> } })._prism;
    if (prism) prism.headers[name] = value;
    return originalSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const prism = (this as XMLHttpRequest & {
      _prism?: {
        method: string;
        url: string;
        headers: Record<string, string>;
        start: number;
      };
    })._prism;

    if (prism) {
      prism.start = Date.now();
    }

    const requestBody =
      body == null
        ? undefined
        : typeof body === 'string'
          ? body
          : body instanceof URLSearchParams
            ? body.toString()
            : String(body);

    const onLoadEnd = () => {
      if (!prism) return;

      let responseHeaders: Record<string, string> = {};
      const raw = this.getAllResponseHeaders();
      if (raw) {
        raw.split('\r\n').forEach((line) => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            responseHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        });
      }

      const payload: NetworkPayload = {
        method: prism.method,
        url: prism.url,
        status: this.status,
        statusText: this.statusText,
        requestHeaders: prism.headers,
        responseHeaders,
        requestBody,
        responseBody: this.responseType === '' || this.responseType === 'text' ? String(this.responseText ?? '') : undefined,
        durationMs: Date.now() - prism.start,
        initiator: 'xhr',
      };

      captureNetworkEvent(payload);
      this.removeEventListener('loadend', onLoadEnd);
    };

    this.addEventListener('loadend', onLoadEnd);
    return originalSend.call(this, body);
  };

  return () => {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    XMLHttpRequest.prototype.setRequestHeader = originalSetHeader;
  };
}
