import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const openApiText = readFileSync(new URL("../packages/core/openapi/openapi.json", import.meta.url), "utf8");
const accountingOpenApi = JSON.parse(
  readFileSync(new URL("../packages/accounting/openapi/openapi-embed-v1.json", import.meta.url), "utf8"),
) as {
  tags?: Array<{ name: string }>;
  paths: Record<string, Record<string, { get?: Record<string, unknown>; tags?: string[] }>>;
  components?: { schemas?: Record<string, unknown> };
};
const openApi = JSON.parse(openApiText) as {
  info: { title: string; description?: string; contact?: { name?: string; email?: string }; license?: { name?: string } };
  servers?: Array<{ url?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, { operationId?: string }>>;
};

const accountingReportPaths = [
  "/v1/reports/trial-balance",
  "/v1/reports/balance-sheet",
  "/v1/reports/income-statement",
  "/v1/reports/cash-flow",
  "/v1/reports/general-ledger",
  "/v1/reports/general-ledger-detailed",
  "/v1/reports/journal-report",
];

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("public package metadata", () => {
  it("ships Paprel metadata without legacy product branding", () => {
    assert.match(openApi.info.title, /Paprel/);
    assert.equal(openApi.info.contact?.name, "Paprel Support");
    assert.equal(openApi.info.contact?.email, "support@paprel.com");
    assert.equal(openApi.info.license?.name, "Proprietary");
    assert.doesNotMatch(openApiText, /NewLedger|newledger\.io/);
    assert.doesNotMatch(openApiText, /AES-256|AES-encrypted/);
    // Assert the conventions a generated client cannot infer from the paths alone,
    // rather than a particular security mechanism: the description's security
    // wording tracks the gateway and is not a contract partners depend on.
    assert.match(openApi.info.description ?? "", /x-partner-domain/);
    assert.match(openApi.info.description ?? "", /under `data`/);
  });

  it("documents the server-only App Connect client-credentials contract", () => {
    const operation = openApi.paths["/v1/app-connect/oauth/token"]?.post;
    assert.ok(operation);
    const serialized = JSON.stringify(operation);
    assert.match(serialized, /x-partner-domain/);
    assert.match(serialized, /client_credentials/);
    assert.match(serialized, /client_secret/);
    assert.doesNotMatch(serialized, /x-data-signature|Bearer <JWT_TOKEN>/);
    assert.equal("security" in operation, false);
  });

  it("matches the public Paprel gateway contract", () => {
    assert.deepEqual(openApi.servers?.map(({ url }) => url), [
      "https://api-sandbox.paprel.com",
      "https://api.paprel.com",
    ]);
    // OAuth discovery has to answer at the root: RFC 8414 and RFC 9728 define these
    // exact locations, so they cannot be version-prefixed like the rest of the API.
    const rootPaths = new Set([
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/oauth/authorize",
    ]);
    const versioned = Object.keys(openApi.paths).filter((path) => !rootPaths.has(path));
    assert.ok(versioned.every((path) => path.startsWith("/v1/")));
    assert.ok(Object.keys(openApi.paths).every((path) => !path.includes("//")));

    const operationIds = Object.values(openApi.paths).flatMap((pathItem) =>
      Object.values(pathItem).flatMap((operation) => operation.operationId ?? []),
    );
    assert.equal(new Set(operationIds).size, operationIds.length, "operationId values must be unique");
  });

  it("declares every operation tag and preserves curated explorer labels", () => {
    const declaredTags = new Set(openApi.tags?.map(({ name }) => name));
    const usedTags = new Set(
      Object.values(openApi.paths).flatMap((pathItem) =>
        Object.values(pathItem).flatMap((operation) => (operation as { tags?: string[] }).tags ?? []),
      ),
    );
    assert.deepEqual([...usedTags].filter((tag) => !declaredTags.has(tag)), []);
    for (const tag of [
      "Access & Permissions",
      "Action Verification",
      "Audit Activity",
      "Company / Email Delivery",
      "Late Fees",
      "Projects & Timesheets",
      "Configuration & Reference Data",
      "Taxes & Submissions",
      "Expenses",
      "Financial Reports",
    ]) {
      assert.ok(declaredTags.has(tag), `missing curated tag ${tag}`);
    }
  });

  it("publishes every report in the complete contract and optional accounting slice", () => {
    for (const path of accountingReportPaths) {
      assert.ok(openApi.paths[path]?.get, `missing GET ${path}`);
      assert.ok(accountingOpenApi.paths[path]?.get, `accounting slice missing GET ${path}`);
    }
  });

  it("ships a structurally complete optional accounting contract", () => {
    const declaredTags = new Set(accountingOpenApi.tags?.map(({ name }) => name));
    const usedTags = new Set(
      Object.values(accountingOpenApi.paths).flatMap((pathItem) =>
        Object.values(pathItem).flatMap((operation) => operation.tags ?? []),
      ),
    );
    assert.deepEqual([...usedTags].filter((tag) => !declaredTags.has(tag)), []);

    const serialized = JSON.stringify(accountingOpenApi);
    const schemaRefs = [...serialized.matchAll(/#\/components\/schemas\/([^"\\]+)/g)].map((match) => match[1]);
    const schemas = accountingOpenApi.components?.schemas ?? {};
    assert.deepEqual([...new Set(schemaRefs)].filter((name) => !(name in schemas)), []);
  });

  it("contains no links to private or removed reference paths", () => {
    const repoPath = root.pathname;
    const files = [join(repoPath, "README.md"), ...markdownFiles(join(repoPath, "docs")), ...markdownFiles(join(repoPath, "packages"))];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /handbook\/|component[ -]lab|paprel-embed-ui-examples\/(?:blob|tree)\/main\/shared/, file);
    }
  });

  it("keeps beta packages aligned and makes untagged installs resolve the current beta", () => {
    const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    const versions = ["core", "ui", "accounting", "reports"].map((name) => {
      const manifest = JSON.parse(readFileSync(new URL(`../packages/${name}/package.json`, import.meta.url), "utf8")) as {
        version: string;
        publishConfig?: { tag?: string };
      };
      assert.equal(manifest.publishConfig?.tag, undefined);
      return manifest.version;
    });
    assert.ok(versions.every((version) => version === versions[0]), versions.join(", "));
    assert.match(versions[0], /^\d+\.\d+\.\d+-beta\.\d+$/);
    assert.match(rootPackage.scripts.release, /changeset publish$/);
    assert.doesNotMatch(rootPackage.scripts.release, /--tag/);
  });
});
