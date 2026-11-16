#!/usr/bin/env node
/** Packages reviewed source only; never environment files, uploads or backups. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { parseArgs } = require("node:util");
const { privateDirectory } = require("./migrate-encryption-local");
const root = path.resolve(__dirname, "../..");

function sourceFile(name) {
  if (
    !name ||
    name.includes("\\") ||
    name.startsWith("/") ||
    name.split("/").some((part) => part === ".." || !part)
  )
    return false;
  const parts = name.split("/"),
    base = parts.at(-1);
  if (
    parts.includes(".ssh") ||
    [
      ".npmrc",
      ".yarnrc",
      ".yarnrc.yml",
      ".netrc",
      ".pgpass",
      ".pg_service.conf",
      "id_rsa",
      "id_ed25519",
    ].includes(base)
  )
    return false;
  if (
    parts.some((part) =>
      [
        ".git",
        ".aws",
        ".codex",
        ".agents",
        "backups",
        "uploads",
        "node_modules",
        ".next",
        "dist",
        "coverage",
        "scratch",
        "logs",
        "postgres_data",
        "redis_data",
      ].includes(part),
    )
  )
    return false;
  if (
    (base.startsWith(".env") || base.endsWith(".env")) &&
    !base.endsWith(".env.example") &&
    base !== ".env.example"
  )
    return false;
  if (/\.(?:pem|key|crt|dump|enc|zip|log|tsbuildinfo)$/i.test(base))
    return false;
  if (/credentials.*\.(?:csv|json)$/i.test(base)) return false;
  if (
    /^(?:storage|application-secrets|production|recovery)\.env(?:\.|$)/i.test(
      base,
    ) &&
    !base.endsWith(".example")
  )
    return false;
  return true;
}
function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error)
    throw new Error("Could not inventory source");
  return result.stdout;
}
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
async function main() {
  parseArgs({ options: {} });
  const JSZip = require(
    require.resolve("jszip", { paths: [path.join(root, "apps/api")] }),
  );
  const files = [
    ...new Set(
      git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
        .split("\0")
        .filter(sourceFile),
    ),
  ].sort();
  if (files.length < 10 || files.length > 10000)
    throw new Error("Unexpected source inventory");
  const zip = new JSZip(),
    inventory = [];
  let totalBytes = 0;
  for (const name of files) {
    const filename = path.join(root, name);
    const relative = path
      .relative(fs.realpathSync(root), fs.realpathSync(filename))
      .split(path.sep)
      .join("/");
    if (
      !sourceFile(relative) ||
      relative.startsWith("../") ||
      path.isAbsolute(relative)
    )
      throw new Error("Redirected source path");
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("Only ordinary source files are packaged");
    const bytes = fs.readFileSync(filename);
    totalBytes += bytes.length;
    if (totalBytes > 200 * 1024 * 1024)
      throw new Error("Source archive size limit exceeded");
    zip.file(name, bytes, {
      date: new Date("2026-01-01T00:00:00Z"),
      unixPermissions: name.endsWith(".sh") ? 0o100755 : 0o100644,
    });
    inventory.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    baseCommit: git(["rev-parse", "HEAD"]).trim(),
    workingTreeSource: true,
    files: inventory,
  };
  zip.file(
    ".deployment-source.json",
    JSON.stringify(manifest, null, 2) + "\n",
    { unixPermissions: 0o100644 },
  );
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
  for (const entry of inventory)
    if (sha256(fs.readFileSync(path.join(root, entry.path))) !== entry.sha256)
      throw new Error("Source changed during packaging");
  const directory = privateDirectory(),
    archive = path.join(directory, "school-erp-staging-source.zip");
  fs.writeFileSync(archive, bytes, { flag: "wx", mode: 0o600 });
  const report = {
    createdAt: manifest.createdAt,
    baseCommit: manifest.baseCommit,
    sourceFiles: inventory.length,
    uncompressedBytes: totalBytes,
    archiveBytes: bytes.length,
    archiveSha256: sha256(bytes),
    privateRuntimeConfigurationIncluded: false,
    backupsIncluded: false,
    schoolUploadsIncluded: false,
    archive,
  };
  fs.writeFileSync(archive + ".json", JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { sourceFile };
if (require.main === module)
  main().catch(() => {
    console.error(
      "Source packaging failed or was refused; no live records or deployment settings were changed.",
    );
    process.exitCode = 1;
  });
