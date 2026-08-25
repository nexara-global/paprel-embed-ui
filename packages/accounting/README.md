# @paprel/embed-accounting

Embedded Paprel operational accounting — typed resources and Web Components for COA, journals, banking, transactions, and reconciliation. Financial report components ship together in `@paprel/embed-reports`.

The list components emit the shared `paprel:view-change` and `paprel:resource-open` events exported by `@paprel/embed-core`. The host can use one delegated listener to synchronize search, filters, tabs, and pagination with its router and to open resource pages. Paprel does not require or install a router.

## Install

```bash
npm install @paprel/embed-core @paprel/embed-accounting
```

## Quick start

```ts
import { configureAccounting } from "@paprel/embed-accounting";

configureAccounting({
  baseUrl: "", // same-origin /v1 proxy, or https://api.paprel.com
  locale: "en",
  auth: {
    partnerDomain: "app.partner.com",
    async getTokens() {
      const res = await fetch("/api/embed-token", { credentials: "include" });
      const body = await res.json();
      return {
        accessToken: body.accessToken,
        expiresAt: body.expiresAt,
        permissions: body.permissions,
        companyId: body.companyId,
      };
    },
  },
});

```

```html
<paprel-chart-of-accounts></paprel-chart-of-accounts>
```

The main import registers all accounting custom elements and includes their styles. No separate CSS or UI-package import is required.

### Host-owned transaction lock action

The transaction-lock list keeps creation in the host page header. Call the element's public `openCreate()` method from your CTA:

```ts
const locks = document.querySelector("paprel-transaction-locks");
newLockButton.addEventListener("click", () => locks?.openCreate());
```

Successful mutations emit the shared `paprel:operation-success` event documented by `@paprel/embed-core`.

### Match your product theme

Override inherited semantic variables on a wrapper:

```css
.my-product {
  --paprel-font-family: Inter, sans-serif;
  --paprel-color-primary: #2563eb;
  --paprel-color-surface: #fff;
  --paprel-color-text: #0f172a;
  --paprel-color-muted: #64748b;
  --paprel-color-border: #e2e8f0;
  --paprel-radius: 8px;
}
```

See `@paprel/embed-ui` for the shared token contract. Importing `@paprel/embed-ui/styles.css` directly is optional.

## OpenAPI

The versioned accounting API slice ships at `@paprel/embed-accounting/openapi/openapi-embed-v1.json` for tooling and integration reference.

## Documentation

- [Embedded UI overview](https://paprel.com/documentation/embedded-ui/overview)
- [Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff)
- [20-minute integration guide](https://paprel.com/documentation/guides/build-embedded-accounting-20-minutes)
- [BFF token contract](https://github.com/nexara-global/paprel-embed-ui/blob/main/docs/partner-integration/bff-contract.md)
- [Framework-neutral sample application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting)

Your backend must implement the embed token route — see the BFF contract link above.
