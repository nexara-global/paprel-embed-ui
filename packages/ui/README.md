# @paprel/embed-ui

Shared semantic CSS tokens and component chrome for Paprel domain packages.

Domain packages such as `@paprel/embed-accounting` include these styles automatically. Consumers only install this package directly when they want the standalone token stylesheet or future UI primitives.

Override semantic `--paprel-*` custom properties on a wrapper or individual component:

```css
.my-product {
  --paprel-font-family: Inter, sans-serif;
  --paprel-color-primary: #2563eb;
  --paprel-color-primary-text: #fff;
  --paprel-color-surface: #fff;
  --paprel-color-surface-muted: #f8fafc;
  --paprel-color-text: #0f172a;
  --paprel-color-muted: #64748b;
  --paprel-color-border: #e2e8f0;
  --paprel-color-border-subtle: #f1f5f9;
  --paprel-color-focus: rgb(37 99 235 / 18%);
  --paprel-radius: 8px;
  --paprel-radius-sm: 6px;
  --paprel-shadow-sm: 0 1px 2px rgb(15 23 42 / 5%), 0 12px 34px -20px rgb(15 23 42 / 25%);
}
```

The token contract is inherited through Web Component shadow roots. Paprel components do not apply a global reset or overwrite host application styles.

## Token layers

- Brand: `--paprel-color-primary`, `--paprel-color-primary-hover`, `--paprel-color-primary-text`
- Surfaces: `--paprel-color-surface`, `--paprel-color-surface-muted`
- Content: `--paprel-color-text`, `--paprel-color-muted`, `--paprel-color-danger`
- Borders: `--paprel-color-border`, `--paprel-color-border-subtle`
- Typography: `--paprel-font-family`, `--paprel-font-size`
- Geometry: `--paprel-radius`, `--paprel-radius-sm`
- Effects: `--paprel-shadow-sm`, `--paprel-color-focus`

Global semantic tokens are the stable customization API. Component-specific tokens and `::part()` hooks should only be introduced when a real integration cannot be expressed through these shared variables.
