# Paprel Embed — documentation

Partner-facing documentation for Paprel embed integration.

Use `@paprel/embed-core` for shared auth and transport, then install complete domain packages such as `@paprel/accounting`. Each domain owns its typed resources and UI. `@paprel/ui` supplies the inherited theme contract without requiring a separate consumer import.

## Quick links

| Doc | Audience |
|-----|----------|
| [Partner integration hub](partner-integration/README.md) | **Start here** — BFF, OpenAPI, sample app |
| [BFF contract](partner-integration/bff-contract.md) | Backend engineers + AI codegen |
| [AI prompts](prompts/README.md) | Cursor / Claude / Codex integration workflows |
| [Public embedded UI overview](https://paprel.com/documentation/embedded-ui/overview) | Product and integration overview |
| [Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff) | Server-side token exchange guide |
| [Examples](https://github.com/nexara-global/paprel-embed-ui-examples) | Complete runnable host applications |

## Typical workflow

1. Receive App Connect credentials + OpenAPI embed slice (`@paprel/accounting/openapi/openapi-embed-v1.json` after install, or [API documentation](https://paprel.com/api-documentation))
2. Open [`prompts/build-embed-bff.md`](prompts/build-embed-bff.md) with your stack filled in
3. Implement `/api/embed-token` per [`bff-contract.md`](partner-integration/bff-contract.md)
4. Wire `configureAccounting` and mount widgets using the [component lab](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/component-lab) as reference
5. Smoke against the standalone [Paprel Embed examples](https://github.com/nexara-global/paprel-embed-ui-examples)

## Monorepo layout

| Path | Contents |
|------|----------|
| `packages/core` | `@paprel/embed-core` |
| `packages/ui` | `@paprel/ui` |
| `packages/accounting` | `@paprel/accounting` |
| `packages/reports` | `@paprel/reports` — all financial report components |
| [Paprel Embed examples](https://github.com/nexara-global/paprel-embed-ui-examples) | Standalone widget smoke app and public reference applications |
| `docs/partner-integration/` | BFF contract + hub |
| `docs/prompts/` | AI prompt pack |
