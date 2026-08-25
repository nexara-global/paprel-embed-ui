# Partner integration hub

Docs for integrating Paprel into your product.

Install `@paprel/embed-core` for shared auth and transport plus the domain packages you need. `@paprel/embed-accounting` contains the complete accounting integration, including typed resources and Web Components. Its UI inherits `@paprel/embed-ui` theme variables automatically.

## Start here

| I want to… | Read |
|------------|------|
| Run the reference app locally | [Framework-neutral real-estate accounting app](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting) |
| **Public docs (paprel.com)** | [Build the embed token BFF](https://paprel.com/documentation/embedded-ui/build-bff) |
| Understand why I need a BFF | [Build the embed token BFF](https://paprel.com/documentation/embedded-ui/build-bff) |
| Implement the BFF (contract + security) | [`bff-contract.md`](bff-contract.md) |
| Use Cursor / Claude / Codex to generate integration code | [`../prompts/README.md`](../prompts/README.md) |
| SDK configuration and auth model | [`../../README.md`](../../README.md#partner-integration) |

## Packages

```bash
npm install @paprel/embed-core @paprel/embed-accounting @paprel/embed-reports
```

| Package | Role |
|---------|------|
| `@paprel/embed-core` | Shared HTTP client, App Connect token lifecycle, errors and primitives |
| `@paprel/embed-accounting` | Complete accounting resources and Web Components |
| `@paprel/embed-reports` | Complete financial reports module; uses the shared accounting session |
| `@paprel/embed-ui` | Shared theme contract; installed transitively by domain packages |

## Integration in three steps

1. **App Connect client** — Paprel operator creates client, grants scopes, copies token URL + credentials.
2. **Partner BFF** — One route exchanges `client_credentials` for an access token ([`bff-contract.md`](bff-contract.md)).
3. **Frontend** — `configureAccounting` + mount widgets ([`../prompts/wire-embed-widgets.md`](../prompts/wire-embed-widgets.md)).

## OpenAPI

Embed v1 API slice (for codegen and AI context):

- npm: `@paprel/embed-accounting/openapi/openapi-embed-v1.json` (after `npm install @paprel/embed-core`)
- Full gateway spec: [paprel.com API documentation](https://paprel.com/api-documentation)

The slice is versioned with the package so consumer tooling always matches the installed SDK release.

## Sample reference code

| File | What it shows |
|------|----------------|
| [Dev token BFF](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/server/embed-token-bff.ts) | Dev BFF (token exchange) |
| [Reference frontend](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/src/app.ts) | Host routing + widget shell |
| [Reference Vite config](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/vite.config.ts) | Same-origin BFF middleware (dev only) |

Production partners replace the Vite middleware with a real server route; the **contract stays the same**.

## Typical partner dev workflow

When Paprel shares OpenAPI + embed docs, a partner engineer (or AI agent) should:

1. Open [`../prompts/build-embed-bff.md`](../prompts/build-embed-bff.md)
2. Attach `openapi-embed-v1.json`, [`bff-contract.md`](bff-contract.md), and this guide
3. Fill in **Partner stack** (framework, auth, widgets)
4. Generate BFF route + `configureAccounting` page
5. Verify against the [reference application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting) behavior (token 200, widgets load, Bearer on `/v1/...`)

Stack-only prompts: [`bff-express.md`](../prompts/bff-express.md), [`bff-nextjs.md`](../prompts/bff-nextjs.md). Widget-only (BFF exists): [`wire-embed-widgets.md`](../prompts/wire-embed-widgets.md).
