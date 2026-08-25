import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["core", "ui", "accounting", "reports"];
const testRoot = mkdtempSync(join(tmpdir(), "paprel-consumer-check-"));
const tarballsDir = join(testRoot, "tarballs");
const consumerDir = join(testRoot, "consumer");
const cacheDir = join(testRoot, "npm-cache");

mkdirSync(tarballsDir);
mkdirSync(consumerDir);

try {
  const tarballs = packages.map((name) => {
    const raw = execFileSync(
      "npm",
      ["pack", "--json", "--pack-destination", tarballsDir, "--cache", cacheDir],
      { cwd: join(root, "packages", name), encoding: "utf8" },
    );
    return join(tarballsDir, JSON.parse(raw)[0].filename);
  });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "paprel-consumer-check", private: true, type: "module" }, null, 2),
  );
  writeFileSync(
    join(consumerDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
      },
      include: ["index.ts"],
    }, null, 2),
  );
  writeFileSync(
    join(consumerDir, "index.ts"),
    [
      'import type { EmbedTokenSet } from "@paprel/embed-core";',
      'import { configureAccounting } from "@paprel/embed-accounting/configure";',
      'import "@paprel/embed-reports";',
      'const getTokens = async (): Promise<EmbedTokenSet> => ({ accessToken: "test", expiresAt: Date.now() + 60_000 });',
      'configureAccounting({ baseUrl: "https://api.example.test", auth: { partnerDomain: "partner.example.test", getTokens } });',
    ].join("\n"),
  );

  execFileSync("npm", ["install", "--ignore-scripts", "--cache", cacheDir, ...tarballs], {
    cwd: consumerDir,
    stdio: "inherit",
  });
  execFileSync(join(root, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], {
    cwd: consumerDir,
    stdio: "inherit",
  });
  console.log("Fresh consumer install and TypeScript import check — OK");
} finally {
  rmSync(testRoot, { recursive: true, force: true });
}
