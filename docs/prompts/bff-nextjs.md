# Prompt: Next.js App Router embed token route

Implement **only** the Paprel App Connect BFF route for Next.js App Router.

---

## Contract

Read: `paprel-embed/docs/partner-integration/bff-contract.md`

---

## Task

Create `app/api/embed-token/route.ts` (Next.js 13+ App Router).

**Existing auth:** {e.g. `auth()` from NextAuth, Clerk `auth()`, custom session cookie}

---

## Requirements

1. `GET` handler (or `POST` if you prefer)
2. Verify partner user session before token exchange
3. Server env only (no `NEXT_PUBLIC_` for secrets):

```
APP_CONNECT_TOKEN_URL=
APP_CONNECT_CLIENT_ID=
APP_CONNECT_CLIENT_SECRET=
PARTNER_DOMAIN=
```

4. Call Paprel token endpoint; return `EmbedTokenResponse` per contract
5. Use `fetch` in Route Handler (Node runtime, not Edge, if you need custom TLS for local dev)

---

## Implementation sketch

```typescript
// app/api/embed-token/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "..."; // partner auth

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenRes = await fetch(process.env.APP_CONNECT_TOKEN_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-partner-domain": process.env.PARTNER_DOMAIN!,
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.APP_CONNECT_CLIENT_ID,
      client_secret: process.env.APP_CONNECT_CLIENT_SECRET,
    }),
  });

  const raw = await tokenRes.json();
  const data = raw.data ?? raw;

  if (!tokenRes.ok || !data.access_token) {
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  return NextResponse.json({
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    permissions: data.permissions,
    companyId: data.company_id,
    expiresIn,
  });
}
```

---

## Optional: same-origin `/v1` proxy

For production, add `rewrites` in `next.config.js` to proxy `/v1/:path*` → Paprel API. Then frontend uses `baseUrl: ""` in `configureAccounting`.

---

## Reference

- `paprel-embed-ui-examples/apps/real-estate-accounting/server/embed-token-bff.ts`
- Wire widgets: `paprel-embed/docs/prompts/wire-embed-widgets.md`

---

## Deliverables

- `route.ts` + auth integration
- `.env.example`
- Note on `runtime = 'nodejs'` if needed for local HTTPS to `*.localhost`
