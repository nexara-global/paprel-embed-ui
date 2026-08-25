# Prompt: Express / Fastify embed token route

Implement **only** the Paprel App Connect BFF route for Express (or Fastify).

---

## Contract

Read: `paprel-embed/docs/partner-integration/bff-contract.md`

---

## Task

Add `GET /api/embed-token` to my Express app.

**Existing auth middleware:** {describe or paste — e.g. `requireSession`}

---

## Implementation sketch

```typescript
// env: APP_CONNECT_TOKEN_URL, APP_CONNECT_CLIENT_ID, APP_CONNECT_CLIENT_SECRET, PARTNER_DOMAIN

app.get("/api/embed-token", requireSession, async (req, res) => {
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
    return res.status(tokenRes.status).json({ error: "Token exchange failed", body: raw });
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  res.json({
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    permissions: data.permissions,
    companyId: data.company_id,
    expiresIn,
  });
});
```

Adapt `requireSession` to my app. Never expose `client_secret`.

---

## Reference

Full dev implementation: `paprel-embed-ui-examples/apps/real-estate-accounting/server/embed-token-bff.ts`

---

## Deliverables

- Route file + router registration
- `.env.example` entries
- One-line curl test instructions
