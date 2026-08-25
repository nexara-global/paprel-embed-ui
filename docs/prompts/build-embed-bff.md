# Prompt: Build Paprel embed BFF + wire UI

Use this when a developer provides Paprel OpenAPI (embed slice), embedded UI documentation, and asks you to implement the partner integration.

---

## Your task

Implement a **production-ready partner integration** for Paprel embedded accounting:

1. **Backend:** App Connect token exchange route (BFF) — see contract below
2. **Frontend:** Configure `@paprel/embed-accounting` and mount requested widgets
3. **Config:** Document required environment variables

Do not implement accounting business logic in the BFF. The BFF only exchanges `client_credentials` for an access token.

---

## Context documents (read these)

- **BFF contract:** `paprel-embed/docs/partner-integration/bff-contract.md`
- **Integration hub:** `docs/partner-integration/README.md`
- **OpenAPI embed v1:** `@paprel/embed-accounting/openapi/openapi-embed-v1.json` (App Connect + `/v1/accounting/*`, `/v1/reports/*`) — or [paprel.com API documentation](https://paprel.com/api-documentation)
- **Reference BFF:** `paprel-embed-ui-examples/apps/real-estate-accounting/server/embed-token-bff.ts`
- **Reference frontend:** `paprel-embed-ui-examples/apps/real-estate-accounting/src/session/session-manager.ts` (`configureAccounting` block)

---

## Partner stack (FILL IN)

- **Framework:** {e.g. Next.js 15 App Router | Express 4 | FastAPI | Rails 7}
- **Existing auth:** {e.g. session cookie | Auth0 JWT | Supabase}
- **Deploy:** {e.g. Vercel | Fly.io | ECS}
- **API topology:** {same-origin /v1 proxy | direct to Paprel API URL}
- **Widgets needed:** {e.g. paprel-chart-of-accounts, paprel-journal-list, paprel-journal-editor}

---

## BFF requirements (non-negotiable)

### Environment variables (server only)

```
PAPREL_API_BASE_URL=https://api.paprel.com
APP_CONNECT_TOKEN_URL=https://api.paprel.com/v1/app-connect/oauth/token
APP_CONNECT_CLIENT_ID=PLC_...
APP_CONNECT_CLIENT_SECRET=PLS_...
PARTNER_DOMAIN=app.partner.com
```

### Route: `/api/embed-token` (or equivalent)

1. Verify **partner user is authenticated** (use existing session — adapt to stack)
2. `POST` to `APP_CONNECT_TOKEN_URL` with:
   - Headers: `Content-Type: application/json`, `x-partner-domain: PARTNER_DOMAIN`
   - Body: `{ "grant_type": "client_credentials", "client_id", "client_secret" }`
3. Parse Paprel envelope `{ data: { access_token, expires_in, permissions, company_id } }`
4. Return to browser:

```json
{
  "accessToken": "...",
  "expiresAt": 1719600000000,
  "permissions": ["..."],
  "companyId": "...",
  "expiresIn": 14400
}
```

`expiresAt` must be Unix **milliseconds**.

### Errors

Return `{ "error": "..." }` with appropriate HTTP status. Never leak `client_secret`.

---

## Frontend requirements

```typescript
import { configureAccounting } from "@paprel/embed-accounting";

configureAccounting({
  baseUrl: process.env.NEXT_PUBLIC_PAPREL_API_BASE_URL ?? "", // "" if same-origin /v1 proxy
  locale: "en",
  auth: {
    partnerDomain: process.env.NEXT_PUBLIC_PARTNER_DOMAIN!,
    async getTokens() {
      const res = await fetch("/api/embed-token", { credentials: "include" });
      if (!res.ok) throw new Error("Embed token failed");
      const body = await res.json();
      return {
        accessToken: body.accessToken,
        expiresAt: body.expiresAt,
        permissions: body.permissions,
        companyId: body.companyId,
      };
    },
    onSessionExpired() {
      // retry getTokens or redirect to partner login
    },
  },
});

```

Mount widgets **after** configure:

```html
<paprel-chart-of-accounts></paprel-chart-of-accounts>
```

Accounting styles are included by the package and consume inherited `--paprel-*` theme variables. Do not require a separate stylesheet import.

---

## CORS / proxy

If the browser calls Paprel directly, CORS must allow the partner origin. **Prefer:**

- Partner gateway proxies `/v1/*` → Paprel API
- SDK `baseUrl: ""` (same origin)
- BFF at `/api/embed-token` on same origin

Document which approach you implemented.

---

## App Connect scopes

Request scopes on the App Connect client in Paprel settings. Minimum for COA + journals:

- `accounting:account-list`
- `accounting:journal-list`
- `accounting:journal-add`, `accounting:journal-edit` (for editor)

Use the [framework-neutral reference application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting) to verify banking, reports, and transaction workflows.

---

## Deliverables

1. BFF route source file(s)
2. Frontend configure module + example page with requested widgets
3. `.env.example` listing all variables (no secrets)
4. Short README section: how to run locally and verify (status: token exchange returns 200, COA widget loads)

---

## Do NOT

- Put `client_secret` in frontend env (`NEXT_PUBLIC_*`, Vite `VITE_*`, etc.)
- Reimplement Paprel REST handlers in the BFF
- Pass `company_id` on accounting GET query strings
- Skip partner session check on the token route

---

## Verification checklist

- [ ] `GET /api/embed-token` returns `accessToken` + `expiresAt` when partner user is logged in
- [ ] Unauthenticated request to token route returns 401
- [ ] Widget page loads without "configureAccounting required" error
- [ ] Network tab shows `Authorization: Bearer` on `/v1/accounting/...` calls
- [ ] 403 on missing scope surfaces in widget UI (not silent failure)
