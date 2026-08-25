import { readFile, writeFile } from "node:fs/promises";

const packages = ["core", "ui", "accounting", "reports"];
const manifests = packages.map((name) => `packages/${name}/package.json`);
const versionPattern = /("version"\s*:\s*")(\d+\.\d+\.\d+-beta\.)(\d+)(")/;
const sources = await Promise.all(manifests.map((file) => readFile(file, "utf8")));
const versions = sources.map((source, index) => {
  const match = source.match(versionPattern);
  if (!match) throw new Error(`${manifests[index]} does not contain a beta version`);
  return `${match[2]}${match[3]}`;
});

if (!versions.every((version) => version === versions[0])) {
  throw new Error(`Package beta versions are not aligned: ${versions.join(", ")}`);
}

const match = sources[0].match(versionPattern);
const nextVersion = `${match[2]}${Number(match[3]) + 1}`;

if (process.argv.includes("--dry-run")) {
  console.log(`${versions[0]} -> ${nextVersion}`);
  process.exit(0);
}

await Promise.all(sources.map((source, index) =>
  writeFile(manifests[index], source.replace(versionPattern, (_full, prefix, _base, _number, suffix) => `${prefix}${nextVersion}${suffix}`)),
));

const lockFile = "package-lock.json";
const lock = JSON.parse(await readFile(lockFile, "utf8"));
for (const name of packages) {
  const entry = lock.packages?.[`packages/${name}`];
  if (!entry) throw new Error(`${lockFile} is missing packages/${name}`);
  entry.version = nextVersion;
}
await writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

console.log(`Versioned all Paprel embed packages: ${versions[0]} -> ${nextVersion}`);
