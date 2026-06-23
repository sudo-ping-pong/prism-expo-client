# @sudo-ping-pong/prism-expo-client

Real-time debugging SDK for **Expo** and **React Native**. Streams network requests, console output, and Redux/Zustand state to **Prism DevTools** on your Mac.

## Requirements

- Expo SDK 49+ or React Native 0.72+
- [Prism DevTools](https://github.com/sudo-ping-pong/prism-expo-client) macOS app (DMG)
- Device/simulator and Mac on the **same Wi‑Fi**

## Install

```bash
npm install @sudo-ping-pong/prism-expo-client
# or
pnpm add @sudo-ping-pong/prism-expo-client
# or
yarn add @sudo-ping-pong/prism-expo-client
```

[`@sudo-ping-pong/prism-protocol`](https://www.npmjs.com/package/@sudo-ping-pong/prism-protocol) is installed automatically as a dependency.

## Quick start

1. Open **Prism DevTools** on your Mac.
2. Click **Connect App** and note your **LAN IP** (e.g. `192.168.1.100`).
3. Initialize the SDK as early as possible in your app entry file:

```ts
import { initPrismLocal, PrismProfiler } from '@sudo-ping-pong/prism-expo-client';

initPrismLocal('192.168.1.100');

export default function App() {
  return (
    <PrismProfiler id="AppRoot">
      {/* your app */}
    </PrismProfiler>
  );
}
```

`initPrismLocal` is a shortcut for connecting to Prism on port `8080` at the given host.

### Manual host + port

```ts
import { initPrism } from '@sudo-ping-pong/prism-expo-client';

initPrism({
  host: '192.168.1.100',
  port: 8080,
});
```

## What gets captured

| Stream | Default | Source |
|--------|---------|--------|
| Network | on | `fetch`, `XMLHttpRequest`, and `axios` (if installed) |
| Console | on | `console.log` / `warn` / `error` |
| State | opt-in | Redux or Zustand middleware |
| Performance | opt-in | `PrismProfiler` wrapper |

Dev-only by default (`__DEV__`). Pass `forceEnable: true` to run in production builds.

## Redux + time travel

```ts
import { configureStore } from '@reduxjs/toolkit';
import {
  prismReduxMiddleware,
  withPrismStateReplay,
  registerPrismReduxStore,
} from '@sudo-ping-pong/prism-expo-client';

const store = configureStore({
  reducer: withPrismStateReplay(rootReducer),
  middleware: (gDM) => gDM().concat(prismReduxMiddleware('my-store')),
});

registerPrismReduxStore(store, 'my-store');
```

In Prism DevTools → **State**, select an action and use **Replay Action** or **Jump to State**.

## Zustand

```ts
import { create } from 'zustand';
import { prismZustandMiddleware } from '@sudo-ping-pong/prism-expo-client';

const useStore = create(
  prismZustandMiddleware('my-store')((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  })),
);
```

## API

| Export | Description |
|--------|-------------|
| `initPrism(config)` | Connect with full options |
| `initPrismLocal(host, overrides?)` | Connect to Prism on LAN IP |
| `reconnectPrism(config)` | Change host/port without reinstalling patches |
| `destroyPrism()` | Disconnect and remove patches |
| `PrismProfiler` | Capture React render timings |
| `prismReduxMiddleware` | Redux action + state snapshots |
| `prismZustandMiddleware` | Zustand state snapshots |
| `installAxiosPatch(axios?)` | Patch axios interceptors manually |

### Config options

```ts
initPrism({
  host: '192.168.1.100',
  port: 8080,           // default 8080
  network: true,        // fetch + XHR + axios (when installed)
  logs: true,           // console
  forceEnable: false,   // only __DEV__ when false
  onConnect: () => {},
  onDisconnect: () => {},
  onError: (err) => {},
});
```

## Axios

Install axios in your app — Prism auto-patches the default instance and instances from `axios.create()`:

```bash
pnpm add axios
```

```ts
import axios from 'axios';
import { initPrismLocal } from '@sudo-ping-pong/prism-expo-client';

initPrismLocal('192.168.1.100');

const { data } = await axios.get('https://api.example.com/users');
```

Requests appear in Prism with initiator **AXIOS**. Duplicate fetch/XHR events are suppressed while axios handles the request.

To patch a specific axios module manually:

```ts
import axios from 'axios';
import { initPrism, installAxiosPatch } from '@sudo-ping-pong/prism-expo-client';

initPrism({ host: '192.168.1.100' });
installAxiosPatch(axios);
```

## Subpath exports

```ts
import { prismReduxMiddleware } from '@sudo-ping-pong/prism-expo-client/redux';
import { prismZustandMiddleware } from '@sudo-ping-pong/prism-expo-client/zustand';
import { PrismProfiler } from '@sudo-ping-pong/prism-expo-client/profiler';
import { installAxiosPatch } from '@sudo-ping-pong/prism-expo-client/axios';
```

## Troubleshooting

**Not connecting**

- Confirm Mac and device are on the same network.
- Use the LAN IP from Prism’s Connect sheet, not `localhost` (on a physical device).
- Check that port `8080` isn’t blocked by a firewall.

**No events in Prism**

- Call `initPrismLocal` before your app renders.
- Ensure you’re in a dev build, or pass `forceEnable: true`.

## Related packages

- [`@sudo-ping-pong/prism-protocol`](https://www.npmjs.com/package/@sudo-ping-pong/prism-protocol) — shared wire types (dependency)

## License

MIT © Prism DevTools
