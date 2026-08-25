import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const openApiText = readFileSync(new URL("../packages/accounting/openapi/openapi-embed-v1.json", import.meta.url), "utf8");
const openApi = JSON.parse(openApiText) as {
  info: { title: string; contact?: { name?: string; email?: string }; license?: { name?: string } };
  paths: Record<string, { post?: Record<string, unknown> }>;
};

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("public package metadata", () => {
  it("ships Paprel MIT metadata without legacy product branding", () => {
    assert.match(openApi.info.title, /Paprel/);
    assert.equal(openApi.info.contact?.name, "Paprel Support");
    assert.equal(openApi.info.contact?.email, "support@paprel.com");
    assert.equal(openApi.info.license?.name, "MIT");
    assert.doesNotMatch(openApiText, /NewLedger|Proprietary/);
  });

  it("documents the server-only App Connect client-credentials contract", () => {
    const operation = openApi.paths["/api/v1/app-connect/oauth/token"]?.post;
    assert.ok(operation);
    const serialized = JSON.stringify(operation);
    assert.match(serialized, /x-partner-domain/);
    assert.match(serialized, /client_credentials/);
    assert.match(serialized, /client_secret/);
    assert.doesNotMatch(serialized, /x-data-signature|Bearer <JWT_TOKEN>/);
    assert.equal("security" in operation, false);
  });

  it("contains no links to private or removed reference paths", () => {
    const repoPath = root.pathname;
    const files = [join(repoPath, "README.md"), ...markdownFiles(join(repoPath, "docs")), ...markdownFiles(join(repoPath, "packages"))];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /handbook\/|component[ -]lab|paprel-embed-ui-examples\/(?:blob|tree)\/main\/shared/, file);
    }
  });

  it("keeps beta packages aligned and publishes them under the beta dist-tag", () => {
    const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    const versions = ["core", "ui", "accounting", "reports"].map((name) => {
      const manifest = JSON.parse(readFileSync(new URL(`../packages/${name}/package.json`, import.meta.url), "utf8")) as { version: string };
      return manifest.version;
    });
    assert.ok(versions.every((version) => version === versions[0]), versions.join(", "));
    assert.match(versions[0], /^\d+\.\d+\.\d+-beta\.\d+$/);
    assert.match(rootPackage.scripts.release, /changeset publish --tag beta$/);
  });
});
