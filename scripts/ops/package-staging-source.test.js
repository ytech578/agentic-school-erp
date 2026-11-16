const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sourceFile } = require("./package-staging-source");

test("source packaging excludes private configuration, keys, backups and school documents", () => {
  for (const name of [
    ".npmrc",
    ".ssh/config",
    "apps/web/.yarnrc.yml",
    ".pgpass",
    "id_ed25519",
  ])
    assert.equal(sourceFile(name), false, name);
  for (const name of [
    "apps/api/.env",
    "apps/api/.env.runtime",
    ".env.authentik",
    "infrastructure/storage.env",
    "application-secrets.env",
    "backups/neon/backup.dump.enc",
    "apps/api/uploads/student.pdf",
    "nginx/ssl/fullchain.pem",
    "private.key",
    "parent_credentials.csv",
    "node_modules/pkg/index.js",
    ".git/config",
    "../elsewhere/file",
    "/absolute/file",
    "apps\\api\\.env",
  ])
    assert.equal(sourceFile(name), false, name);
  for (const name of [
    "apps/api/src/main.ts",
    "apps/web/public/logo.svg",
    "package-lock.json",
    ".dockerignore",
    ".env.example",
    "infrastructure/authentik/production.env.example",
    "scripts/ops/package-staging-source.js",
  ])
    assert.equal(sourceFile(name), true, name);
});

test("container and CI builds agree on the supported LTS major tested locally", () => {
  const root = path.resolve(__dirname, "../..");
  for (const filename of ["apps/api/Dockerfile", "apps/web/Dockerfile"]) {
    const content = fs.readFileSync(path.join(root, filename), "utf8");
    assert.equal((content.match(/FROM node:26-alpine/g) || []).length, 2);
    assert.doesNotMatch(content, /FROM node:20-/);
  }
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/ci.yml"),
    "utf8",
  );
  assert.equal((workflow.match(/node-version: 26/g) || []).length, 4);
  assert.doesNotMatch(workflow, /node-version: 20/);
});
