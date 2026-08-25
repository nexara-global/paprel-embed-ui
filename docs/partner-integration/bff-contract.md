# BFF contract — embed token route

Canonical spec for partner backends and AI code generation. If your route matches this, `@paprel/embed-core` works.

## Partner route

**Path:** partner-defined (convention: `GET /api/embed-token`)

**Auth:** Must run only for authenticated partner users (session, JWT, API key — your choice). Do not expose publicly without your own auth gate.

### Success response `200`

```typescript
type EmbedTokenResponse = {
  accessToken: string;
  expiresAt: number; // Unix epoch MILLISECONDS
  permissions?: string[];
  companyId?: string;
  expiresIn?: number; // seconds, optional convenience
};
```

### Error response

```typescript
type EmbedTokenError = {
  error: string;
  status?: number;
  body?: string; // optional upstream detail, dev only
};
```

## Upstream call (server-side only)

```http
POST {APP_CONNECT_TOKEN_URL}
Content-Type: application/json
x-partner-domain: {PARTNER_DOMAIN}

{
  "grant_type": "client_credentials",
  "client_id": "{APP_CONNECT_CLIENT_ID}",
  "client_secret": "{APP_CONNECT_CLIENT_SECRET}"
}
```

Optional body field: `"scope": "accounting:account-list accounting:journal-list"` (space-separated subset).

### Paprel response shape

```json
{
  "data": {
    "access_token": "...",
    "expires_in": 14400,
    "permissions": ["..."],
    "company_id": "..."
  }
}
```

Map to partner response:

```typescript
expiresAt: Date.now() + expires_in * 1000
accessToken: data.access_token
permissions: data.permissions
companyId: data.company_id
```

## SDK mapping

```typescript
import type { EmbedTokenSet } from "@paprel/embed-core";

async function getTokens(): Promise<EmbedTokenSet> {
  const res = await fetch("/api/embed-token", { credentials: "include" });
  const body = await res.json();
  return {
    accessToken: body.accessToken,
    expiresAt: body.expiresAt,
    permissions: body.permissions,
    companyId: body.companyId,
  };
}
```

## Headers on Paprel API calls (browser via SDK)

The SDK attaches automatically when `auth.partnerDomain` is set:

- `Authorization: Bearer {accessToken}`
- `x-partner-domain: {partnerDomain}`

Accounting GETs: **do not** add `company_id` query param — tenant comes from JWT (`JWT.cid`).

## Non-goals (do not put in BFF)

- Storing accounting business logic
- Proxying every `/v1/*` call (optional; not required for v1)
- Caching tokens in Redis across users without binding to partner session
- Returning `client_secret` or long-lived refresh tokens to the browser

## Reference implementations

- Dev: [reference example token BFF](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/server/embed-token-bff.ts)
- Prompts: [`docs/prompts/bff-express.md`](../prompts/bff-express.md), [`bff-nextjs.md`](../prompts/bff-nextjs.md)
