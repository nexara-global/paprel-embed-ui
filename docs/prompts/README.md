# AI prompts — Paprel embed integration

Copy these into **Cursor**, **Claude**, or **Codex** when building a partner integration. Attach or paste the files listed in each prompt.

## Prompt index

| Prompt | Use when |
|--------|----------|
| [`build-embed-bff.md`](build-embed-bff.md) | **Primary** — "Implement BFF + wire widgets" (OpenAPI + embed docs + stack) |
| [`wire-embed-widgets.md`](wire-embed-widgets.md) | BFF exists; add `@paprel/embed-accounting` to a page |
| [`bff-express.md`](bff-express.md) | Express / Fastify token route only |
| [`bff-nextjs.md`](bff-nextjs.md) | Next.js App Router token route only |

## Files to attach (recommended)

When asking an agent to build integration from scratch, provide:

1. **OpenAPI embed slice** — `@paprel/embed-accounting/openapi/openapi-embed-v1.json` (after `npm install @paprel/embed-core`), or [paprel.com API documentation](https://paprel.com/api-documentation)
2. **BFF contract** — [`../partner-integration/bff-contract.md`](../partner-integration/bff-contract.md)
3. **Partner BFF guide** — [Paprel: Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff)
4. **This prompt** — [`build-embed-bff.md`](build-embed-bff.md)
5. **Your constraints** — framework, auth system, deploy target

## Security rules (include in every session)

- `APP_CONNECT_CLIENT_SECRET` only in server environment variables
- Never import or bundle the secret in frontend code
- BFF route must require the partner's user session before minting a Paprel token
- Do not log full access tokens in production

## After generation

- Compare output to the [reference BFF](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/server/embed-token-bff.ts)
- Smoke with the [framework-neutral reference application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting)
