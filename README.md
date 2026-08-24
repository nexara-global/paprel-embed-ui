# Paprel Embed UI

npm packages for embedding Paprel in partner apps.

**First release scope:** full embedded accounting plus the complete financial reports module.

**Product shape:** **`@paprel/embed-core`** provides shared auth and transport. **`@paprel/accounting`** is the complete accounting domain package, including its typed resources and embeddable Web Components. Future domains follow the same shape (`@paprel/sales`, `@paprel/purchases`, …). **`@paprel/ui`** owns the shared theme contract and is included by domain packages.

| Package | Description |
|---------|-------------|
| `@paprel/embed-core` | Shared HTTP client, App Connect token lifecycle, errors and primitives |
| `@paprel/ui` | Semantic theme tokens and shared UI primitives |
| `@paprel/accounting` | Operational accounting: accounts, journals, banking, transactions and reconciliation |
| `@paprel/reports` | Complete reporting module: TB, BS, P&L, cash flow and general ledger |

## SDK development

```bash
npm install
npm run build
npm test
```

## Example applications

Consumer examples now live in the dedicated [Paprel Embed examples repository](https://github.com/nexara-global/paprel-embed-ui-examples). Keeping examples separate ensures they install the SDK as real consumers instead of relying on package workspaces.

## Partner integration

**Start here:** [`docs/partner-integration/README.md`](docs/partner-integration/README.md) — BFF contract, security model, and links to handbook.

| Goal | Doc |
|------|-----|
| Why you need a BFF | [Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff) |
| Token route contract (for humans + AI) | [`docs/partner-integration/bff-contract.md`](docs/partner-integration/bff-contract.md) |
| Cursor / Claude / Codex prompts | [`docs/prompts/README.md`](docs/prompts/README.md) — attach OpenAPI slice + `build-embed-bff.md` |
| Reference BFF (dev) | [Paprel Embed examples](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/shared) |

Typical flow: App Connect client → partner `/api/embed-token` → `configureAccounting` → mount widgets.

```ts
import { configureAccounting } from "@paprel/accounting";

configureAccounting({
  baseUrl: "https://api.paprel.com",
  locale: "en", // en | ko | es | ru
  auth: {
    partnerDomain: "app.paprel.com",
    async getTokens() {
      const res = await fetch("/api/embed-token");
      const { accessToken, expiresAt, permissions } = await res.json();
      return { accessToken, expiresAt, permissions };
    },
    onSessionExpired() {
      window.location.href = "/login";
    },
  },
});

```

```html
<paprel-chart-of-accounts></paprel-chart-of-accounts>
<paprel-journal-list page="1"></paprel-journal-list>
<paprel-journal-editor currency="USD"></paprel-journal-editor>
```

## Web Components (v1)

Layer A: COA, account picker/form, journals. Layer B: reports, banking, transactions, matching, reconciliations. See the [component lab screen list](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/component-lab#screens).

Theme via inherited semantic CSS variables (`--paprel-color-primary`, …) from `@paprel/ui`. No stylesheet import is required; override tokens on a wrapper or individual component.

## Documentation

- [Repository documentation](docs/README.md)
- [Partner integration guide](docs/partner-integration/README.md)
- [BFF token contract](docs/partner-integration/bff-contract.md)
- [Public examples](https://github.com/nexara-global/paprel-embed-ui-examples)
- [Paprel embedded UI documentation](https://paprel.com/documentation/embedded-ui/overview)

## Publishing to npm

Packages are `@paprel/embed-core`, `@paprel/ui`, `@paprel/accounting`, and `@paprel/reports` (public, version-linked via changesets). Publishing is **manual only** via [`.github/workflows/release.yml`](.github/workflows/release.yml) — dispatch from **`main`**.

### One-time npm setup

1. Create the **`paprel`** org on [npmjs.com](https://www.npmjs.com/org/create) (claims the `@paprel` scope).
2. **First publish** each package once from a maintainer machine (npm requires the package to exist before trusted publishing can be configured):
   ```bash
   npm run build && npm run pack:check
   npm publish -w @paprel/embed-core
   npm publish -w @paprel/ui
   npm publish -w @paprel/accounting
   npm publish -w @paprel/reports
   ```
3. On npm, configure trusted publishing for all four packages, including `@paprel/reports`.
   - Organization / user: `nexara-global`
   - Repository: `paprel-embed-ui`
   - Workflow filename: `release.yml` (exact match, including extension)
4. (Recommended) **Settings → Publishing access → Require 2FA and disallow tokens** — OIDC publishes still work; long-lived write tokens are blocked.

Do **not** add an `NPM_TOKEN` secret for publishing. The workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). Requires npm CLI 11.5.1+ (bundled with Node 24 on GitHub runners).

`package.json` `repository.url` must match `https://github.com/nexara-global/paprel-embed-ui` for OIDC validation.

### Release flow

1. In a feature PR, add a changeset when the public API or behavior changes:
   ```bash
   npx changeset
   ```
2. Run `npm run version:packages` on a release branch, review the generated versions and changelogs, and merge that pull request to `main`.
3. **Actions → Release → Run workflow** on branch **`main`**. The workflow verifies and publishes the versions already committed to `main`.

The initial `0.1.0` release can be published directly after this repository is created because those versions are already committed. Subsequent releases should consume their changesets through a version pull request first.

Before the first publish, run the standalone component lab against staging from the [Paprel Embed examples repository](https://github.com/nexara-global/paprel-embed-ui-examples) using an ignored `.env.local` file.

## Community and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Paprel Embed UI is available under the [MIT License](LICENSE) and is provided without warranty or liability as described there.
