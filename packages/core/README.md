# @paprel/embed-core

Shared Paprel embed foundation — HTTP transport, App Connect token lifecycle, errors, and primitives used by domain packages.

## Host integration events

Paprel components use namespaced DOM events so the host application can own routing and URL state without a Paprel router. Events bubble through Shadow DOM and expose versioned, framework-neutral payloads.

```ts
import type { PaprelOperationSuccessDetail, PaprelResourceOpenDetail, PaprelViewChangeDetail } from "@paprel/embed-core";

container.addEventListener("paprel:resource-open", (event) => {
  const { resource, id } = (event as CustomEvent<PaprelResourceOpenDetail>).detail;
  event.preventDefault();
  router.push(`/${resource}/${id}`);
});

container.addEventListener("paprel:view-change", (event) => {
  const { source, state } = (event as CustomEvent<PaprelViewChangeDetail>).detail;
  syncQueryParameters(source.component, state);
});

container.addEventListener("paprel:operation-success", (event) => {
  const { message, action, resource } = (event as CustomEvent<PaprelOperationSuccessDetail>).detail;
  toast.show(message);
  analytics.track(action, resource);
});
```

- `paprel:resource-open` is cancelable and reports `{ resource, id }`.
- `paprel:view-change` reports complete collection state after search, filter, tab, sort, or pagination changes.
- `paprel:operation-success` reports a localized success `message`, stable `action`, and optional `{ type, id }` resource after a mutation completes. Hosts can use it for toast feedback without coupling to component-specific events.
- Event payloads include `version: 1` and `source.component`.
- Existing component-specific events remain available for pre-1.0 compatibility.

## Install

```bash
npm install @paprel/embed-core
```

Use with complete domain packages such as `@paprel/embed-accounting`. Business resources and UI live in their owning domain package, not in core.

## Documentation

- [Embedded UI overview](https://paprel.com/documentation/embedded-ui/overview)
- [Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff)
- [20-minute integration guide](https://paprel.com/documentation/guides/build-embedded-accounting-20-minutes)
- [BFF token contract](https://github.com/nexara-global/paprel-embed-ui/blob/main/docs/partner-integration/bff-contract.md)
