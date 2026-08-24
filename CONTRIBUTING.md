# Contributing

Thank you for helping improve Paprel Embed UI.

## Development

Requires Node.js 22 or later.

```bash
npm ci
npm run lint
npm test
npm run pack:check
npm run consumer:check
```

Keep changes within the owning package and avoid adding application-specific behavior to shared packages. Public API or behavior changes require a Changesets entry:

```bash
npx changeset
```

Never commit credentials, access tokens, customer data, or private infrastructure details. By contributing, you agree that your contribution is licensed under the repository's MIT License.

## Pull requests

Keep pull requests focused, explain the consumer impact, and include tests for behavior changes. All checks must pass before merge.
