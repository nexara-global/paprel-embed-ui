import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGES = ["packages/core", "packages/ui", "packages/accounting", "packages/reports"];
const FORBIDDEN = [
  /\.env/i,
  /secret/i,
  /examples\//,
  /\.pem$/,
  /handbook\//,
  /docs\/prompts\//,
];

const cacheDir = mkdtempSync(join(tmpdir(), "paprel-pack-check-"));

try {
  for (const dir of PACKAGES) {
    const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--cache", cacheDir], {
      cwd: dir,
      encoding: "utf8",
    });
    const entry = JSON.parse(raw)[0];
    const paths = entry.files.map((f) => f.path);

    for (const required of ["package.json", "README.md", "LICENSE"]) {
      if (!paths.includes(required)) {
        throw new Error(`${dir}: required public file missing from pack tarball: ${required}`);
      }
    }

    for (const path of paths) {
      for (const pattern of FORBIDDEN) {
        if (pattern.test(path)) {
          throw new Error(`${dir}: forbidden path in pack tarball: ${path}`);
        }
      }
    }

    console.log(`${entry.name}@${entry.version}: ${paths.length} files — OK`);
  }
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
