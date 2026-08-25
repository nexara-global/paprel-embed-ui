# Paprel Embed UI

npm packages for embedding Paprel in partner apps.

**First release scope:** full embedded accounting plus the complete financial reports module.

**Product shape:** **`@paprel/embed-core`** provides shared auth and transport. **`@paprel/embed-accounting`** is the complete embedded accounting package, including its typed resources and Web Components. Future embedded domains follow the same shape (`@paprel/embed-sales`, `@paprel/embed-purchases`, …). **`@paprel/embed-ui`** owns the shared theme contract and is included by embed domain packages. The shorter `@paprel/*` names remain available for future non-embed SDKs.

| Package | Description |
|---------|-------------|
| `@paprel/embed-core` | Shared HTTP client, App Connect token lifecycle, errors and primitives |
| `@paprel/embed-ui` | Semantic theme tokens and shared UI primitives |
| `@paprel/embed-accounting` | Operational accounting: accounts, journals, banking, transactions and reconciliation |
| `@paprel/embed-reports` | Complete reporting module: TB, BS, P&L, cash flow and general ledger |

## SDK development

```bash
npm install
npm run build
npm test
```

## Example applications

Consumer examples now live in the dedicated [Paprel Embed examples repository](https://github.com/nexara-global/paprel-embed-ui-examples). Keeping examples separate ensures they install the SDK as real consumers instead of relying on package workspaces.

## Partner integration

**Start here:** [`docs/partner-integration/README.md`](docs/partner-integration/README.md) — BFF contract, security model, and public integration references.

| Goal | Doc |
|------|-----|
| Why you need a BFF | [Build your BFF](https://paprel.com/documentation/embedded-ui/build-bff) |
| Token route contract (for humans + AI) | [`docs/partner-integration/bff-contract.md`](docs/partner-integration/bff-contract.md) |
| Cursor / Claude / Codex prompts | [`docs/prompts/README.md`](docs/prompts/README.md) — attach OpenAPI slice + `build-embed-bff.md` |
| Reference BFF (dev) | [Real-estate example BFF](https://github.com/nexara-global/paprel-embed-ui-examples/blob/main/apps/real-estate-accounting/server/embed-token-bff.ts) |

Typical flow: App Connect client → partner `/api/embed-token` → `configureAccounting` → mount widgets.

```ts
import { configureAccounting } from "@paprel/embed-accounting";

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

Layer A: COA, account picker/form, journals. Layer B: reports, banking, transactions, matching, reconciliations. See the [framework-neutral reference application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting).

Theme via inherited semantic CSS variables (`--paprel-color-primary`, …) from `@paprel/embed-ui`. No stylesheet import is required; override tokens on a wrapper or individual component.

## Documentation

- [Repository documentation](docs/README.md)
- [Partner integration guide](docs/partner-integration/README.md)
- [BFF token contract](docs/partner-integration/bff-contract.md)
- [Public examples](https://github.com/nexara-global/paprel-embed-ui-examples)
- [Paprel embedded UI documentation](https://paprel.com/documentation/embedded-ui/overview)

## Publishing to npm

Packages are `@paprel/embed-core`, `@paprel/embed-ui`, `@paprel/embed-accounting`, and `@paprel/embed-reports` (public, version-linked via changesets). A maintainer starts releases manually from **`main`** through [`.github/workflows/release.yml`](.github/workflows/release.yml); npm authentication is automated with short-lived GitHub OIDC credentials.

### One-time npm setup

The `@paprel` packages were bootstrapped interactively as `0.1.0-beta.0`. Configure their one-time trusted-publisher relationships from a maintainer machine using npm `11.15.0+`:

1. Authenticate to npm with the maintainer account and passkey:
   ```bash
   npm login --scope=@paprel --registry=https://registry.npmjs.org --auth-type=web
   ```
2. Configure the exact repository and workflow for every package:
   ```bash
   npm trust github @paprel/embed-core --repo nexara-global/paprel-embed-ui --file release.yml --allow-publish
   npm trust github @paprel/embed-ui --repo nexara-global/paprel-embed-ui --file release.yml --allow-publish
   npm trust github @paprel/embed-accounting --repo nexara-global/paprel-embed-ui --file release.yml --allow-publish
   npm trust github @paprel/embed-reports --repo nexara-global/paprel-embed-ui --file release.yml --allow-publish
   ```
3. Verify all four relationships with `npm trust list <package>`.
4. In each package's npm settings, select **Require 2FA and disallow tokens**. Trusted publishing continues to work while long-lived write tokens are blocked.

Do **not** add an `NPM_TOKEN` secret for publishing. The workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC), pins an npm CLI version that supports it, and grants only the required GitHub `id-token: write` permission.

The local beta bootstrap was the only interactive publish. All subsequent releases use the GitHub workflow, and npm automatically attaches provenance for this public repository and its public packages.

`package.json` `repository.url` must match `https://github.com/nexara-global/paprel-embed-ui` for OIDC validation.

### Release flow

1. In a feature PR, add a changeset when the public API or behavior changes:
   ```bash
   npx changeset
   ```
2. Run `npm run version:packages` on a release branch, review the generated versions and changelogs, and merge that pull request to `main`.
3. **Actions → Release → Run workflow** on branch **`main`**. The workflow verifies and publishes the versions already committed to `main`.

Every release after `0.1.0-beta.0` must consume its changesets through a reviewed version pull request before the release workflow is dispatched.

Before publishing, run the framework-neutral [real-estate accounting reference application](https://github.com/nexara-global/paprel-embed-ui-examples/tree/main/apps/real-estate-accounting) against staging using an ignored `.env.local` file.

## Community and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Paprel Embed UI is available under the [MIT License](LICENSE) and is provided without warranty or liability as described there.
