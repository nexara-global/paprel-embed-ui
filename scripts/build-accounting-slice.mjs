// Rebuilds the optional accounting-only slice from the complete public contract.
//
// The slice is a curated surface, not a prefix match: not every /v1/accounting/*
// operation belongs in a partner's accounting-only client. CURATED_OPERATIONS is
// therefore the source of truth for what the slice exposes, and widening it is a
// product decision rather than a side effect of refreshing the spec.
//
// Paths are matched with their parameter names erased, because the gateway renames
// path parameters between releases ({id} -> {anchor_id}) without changing the
// operation. Matching on the shape keeps a refresh from silently dropping an
// operation when only its parameter name moved.
//
// Usage: node scripts/build-accounting-slice.mjs [--check]

import { readFileSync, writeFileSync } from "node:fs";

const CORE_SPEC = new URL("../packages/core/openapi/openapi.json", import.meta.url);
const SLICE_SPEC = new URL("../packages/accounting/openapi/openapi-embed-v1.json", import.meta.url);

const METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/** Curated accounting surface, as METHOD + parameterless path. */
const CURATED_OPERATIONS = [
  "POST /v1/app-connect/oauth/token",
  "POST /v1/app-connect/oauth/token/validate",
  "GET /v1/accounting/accounts",
  "POST /v1/accounting/accounts",
  "GET /v1/accounting/accounts-tree",
  "GET /v1/accounting/accounts/subtype",
  "POST /v1/accounting/accounts/subtype",
  "PUT /v1/accounting/accounts/subtype/{}",
  "GET /v1/accounting/accounts/{}",
  "PUT /v1/accounting/accounts/{}",
  "DELETE /v1/accounting/accounts/{}",
  "GET /v1/accounting/bank-accounts",
  "GET /v1/accounting/journals",
  "POST /v1/accounting/journals",
  "GET /v1/accounting/journals/for-entity",
  "PUT /v1/accounting/journals/void",
  "GET /v1/accounting/journals/{}",
  "PUT /v1/accounting/journals/{}",
  "DELETE /v1/accounting/journals/{}",
  "GET /v1/accounting/reconciliations",
  "POST /v1/accounting/reconciliations",
  "GET /v1/accounting/reconciliations/{}",
  "PUT /v1/accounting/reconciliations/{}",
  "DELETE /v1/accounting/reconciliations/{}",
  "PUT /v1/accounting/reconciliations/{}/save",
  "PUT /v1/accounting/reconciliations/{}/void",
  "GET /v1/accounting/transactions",
  "GET /v1/accounting/transactions/{}",
  "POST /v1/accounting/transactions/confirm-match",
  "POST /v1/accounting/transactions/exclude",
  "POST /v1/accounting/transactions/find-group-match",
  "POST /v1/accounting/transactions/restore",
  "POST /v1/accounting/transactions/revert",
  "GET /v1/reports/trial-balance",
  "GET /v1/reports/balance-sheet",
  "GET /v1/reports/income-statement",
  "GET /v1/reports/cash-flow",
  "GET /v1/reports/general-ledger",
  "GET /v1/reports/general-ledger-detailed",
  "GET /v1/reports/journal-report",
];

const erase = (path) => path.replace(/\{[^}]+\}/g, "{}");
const key = (method, path) => `${method.toUpperCase()} ${erase(path)}`;

function collectRefs(node, found) {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, found);
    return;
  }
  if (!node || typeof node !== "object") return;
  const ref = node.$ref;
  if (typeof ref === "string" && ref.startsWith("#/components/")) {
    const [, , kind, name] = ref.split("/");
    found.add(`${kind}/${name}`);
  }
  for (const value of Object.values(node)) collectRefs(value, found);
}

function collectSecuritySchemes(node, found) {
  if (Array.isArray(node)) {
    for (const item of node) collectSecuritySchemes(item, found);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const requirement of node.security ?? []) {
    for (const name of Object.keys(requirement)) found.add(name);
  }
  for (const value of Object.values(node)) collectSecuritySchemes(value, found);
}

function build(core, previous) {
  const wanted = new Set(CURATED_OPERATIONS);
  const paths = {};
  const seen = new Set();

  for (const [path, pathItem] of Object.entries(core.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!METHODS.has(method)) continue;
      const id = key(method, path);
      if (!wanted.has(id)) continue;
      seen.add(id);
      (paths[path] ??= {})[method] = operation;
      // Parameters declared once for the whole path item apply to each operation.
      if (pathItem.parameters) paths[path].parameters = pathItem.parameters;
    }
  }

  const missing = CURATED_OPERATIONS.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(
      `the complete contract no longer serves ${missing.length} curated operation(s):\n  ${missing.join("\n  ")}\n` +
        "Remove it from CURATED_OPERATIONS deliberately, or fix the upstream spec.",
    );
  }

  // Resolve component references transitively: a schema the slice keeps may itself
  // reference schemas no selected operation names directly.
  const required = new Set();
  collectRefs(paths, required);
  const resolved = new Set();
  while (true) {
    const next = [...required].find((id) => !resolved.has(id));
    if (next === undefined) break;
    resolved.add(next);
    const [kind, name] = next.split("/");
    const node = core.components?.[kind]?.[name];
    if (node) collectRefs(node, required);
  }

  const components = {};
  for (const id of [...resolved].sort()) {
    const [kind, name] = id.split("/");
    const node = core.components?.[kind]?.[name];
    if (node) (components[kind] ??= {})[name] = node;
  }

  // Security schemes are referenced by name in `security`, never by $ref.
  const schemes = new Set();
  collectSecuritySchemes(paths, schemes);
  for (const name of [...schemes].sort()) {
    const node = core.components?.securitySchemes?.[name];
    if (node) (components.securitySchemes ??= {})[name] = node;
  }

  // Every tag an operation uses must be declared, so the slice stays valid on its
  // own. Keep the order the slice already published and append anything new.
  const used = new Set();
  for (const pathItem of Object.values(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!METHODS.has(method)) continue;
      for (const tag of operation.tags ?? []) used.add(tag);
    }
  }
  const byName = new Map((core.tags ?? []).map((tag) => [tag.name, tag]));
  const published = (previous?.tags ?? []).map((tag) => tag.name);
  const order = [...published.filter((name) => used.has(name)), ...[...used].filter((name) => !published.includes(name)).sort()];
  const tags = order.map((name) => byName.get(name) ?? { name });

  return {
    openapi: core.openapi,
    info: previous?.info ?? core.info,
    servers: core.servers,
    tags,
    paths,
    components,
  };
}

const core = JSON.parse(readFileSync(CORE_SPEC, "utf8"));
const previous = JSON.parse(readFileSync(SLICE_SPEC, "utf8"));
const slice = build(core, previous);
const serialized = `${JSON.stringify(slice, null, 2)}\n`;

const operationCount = Object.values(slice.paths).reduce(
  (total, pathItem) => total + Object.keys(pathItem).filter((method) => METHODS.has(method)).length,
  0,
);

if (process.argv.includes("--check")) {
  if (readFileSync(SLICE_SPEC, "utf8") !== serialized) {
    console.error("openapi-embed-v1.json is stale — run: node scripts/build-accounting-slice.mjs");
    process.exit(1);
  }
  console.log(`accounting slice is current (${operationCount} operations)`);
} else {
  writeFileSync(SLICE_SPEC, serialized);
  console.log(`wrote accounting slice: ${operationCount} operations, ${Object.keys(slice.paths).length} paths`);
}
