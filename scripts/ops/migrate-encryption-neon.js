#!/usr/bin/env node
/** Explicit, fenced Neon cutover. Preparation/rehearsal never change live data. */
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { parseArgs } = require("node:util");
const dotenv = require("dotenv");
const {
  neonTargets,
  compatibleConfiguration,
  inspectCutover,
} = require("./neon-cutover-preflight");
const {
  ENV_FILES,
  sha256,
  encryptionEnvironment,
  writeDurable,
  atomicReplace,
  saveCheckpoint,
  readCheckpoint,
  recoveryCopy,
  privateState,
  cloudRuntime,
} = require("./cutover-state");
const {
  privateDirectory,
  withEncryptionEnvironment,
  restoreReport,
  verifyAuth,
} = require("./migrate-encryption-local");
const {
  keyFromValue,
  decryptField,
  rotationSecrets,
  restoredTarget,
  assertTargetDatabase,
  encryptedInventory,
  inventoryFingerprint,
  invariantFingerprint,
  auditFingerprint,
  rotateVerifiedFields,
  FIELDS,
} = require("./encryption-migration");
const { decryptArchive, databaseChecksums } = require("../dr/neon-backup");
const root = path.resolve(__dirname, "../..");
const operation = "neon-encryption-cutover";
let phase = "arguments";

function loadEnvironment() {
  const files = Object.fromEntries(
    ENV_FILES.map((name) => [
      name,
      fs.readFileSync(path.join(root, name), "utf8"),
    ]),
  );
  return {
    files,
    source: dotenv.parse(files[ENV_FILES[0]]),
    runtime: dotenv.parse(files[ENV_FILES[1]]),
  };
}
function backupKey(source) {
  if (!/^[a-f0-9]{64}$/i.test(source.BACKUP_ENCRYPTION_KEY || ""))
    throw new Error("Existing backup custody key required");
  return Buffer.from(source.BACKUP_ENCRYPTION_KEY, "hex");
}
function oldKeys(source, appCrypto) {
  const keys = [
    withEncryptionEnvironment(
      { ...source, NODE_ENV: source.NODE_ENV || "development" },
      () => appCrypto.getPiiEncryptionKey(),
    ),
  ];
  const previous =
    source.PII_ENCRYPTION_KEY_PREV || source.AADHAAR_ENCRYPTION_KEY_PREV;
  if (previous) keys.push(keyFromValue(previous));
  return keys;
}
async function assertLiveTarget(tx, targets, requireFence = false) {
  const [identity] = await tx.$queryRawUnsafe(
    "SELECT current_database() AS name, current_user AS role",
  );
  assert.equal(identity.name, "school_erp");
  assert.equal(identity.role, decodeURIComponent(targets.owner.username));
  assert.equal(decodeURIComponent(targets.app.username), "school_erp_runtime");
  const [runtime] = await tx.$queryRawUnsafe(
    "SELECT rolcanlogin AS login, rolsuper AS superuser, rolbypassrls AS bypass FROM pg_roles WHERE rolname=$1",
    "school_erp_runtime",
  );
  assert.equal(runtime.superuser, false);
  assert.equal(runtime.bypass, false);
  const [ownership] = await tx.$queryRawUnsafe(
    "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role($1::name,c.relowner,'USAGE')",
    "school_erp_runtime",
  );
  assert.equal(ownership.count, 0, "Runtime must not inherit table ownership");
  if (requireFence) assert.equal(runtime.login, false);
}
function freshTimestamp(value, maximumAge) {
  const time = Date.parse(value),
    age = Date.now() - time;
  assert.ok(
    Number.isFinite(time) && age >= 0 && age < maximumAge,
    "Evidence is stale or has an invalid/future timestamp",
  );
}
async function snapshot(client, guard, full = false) {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await guard(tx);
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      const inventory = await encryptedInventory(tx);
      return {
        invariant: await invariantFingerprint(tx),
        encrypted: inventoryFingerprint(inventory),
        audit: await auditFingerprint(tx),
        users: await tx.user.count(),
        mfaUsers: await tx.user.count({ where: { twoFactorEnabled: true } }),
        ...(full ? { checksums: await databaseChecksums(tx) } : {}),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 180000 },
  );
}
async function restoreJournal(tx, journal, guard) {
  await guard(tx);
  await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
  await tx.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    operation,
  );
  const actor = `neon-encryption-rollback:${crypto.randomUUID()}`;
  await tx.$queryRawUnsafe(
    "SELECT set_config('app.current_user_id',$1,true)",
    actor,
  );
  const invariant = await invariantFingerprint(tx),
    audit = await auditFingerprint(tx, actor);
  for (const row of journal) {
    if (
      !FIELDS.some(
        (field) => field.table === row.table && field.field === row.field,
      ) ||
      typeof row.id !== "string"
    )
      throw new Error("Unrecognized rollback field");
    const changed = await tx.$executeRawUnsafe(
      `UPDATE public."${row.table}" SET "${row.field}"=$1 WHERE id=$2 AND "${row.field}"=$3`,
      row.before,
      row.id,
      row.after,
    );
    assert.equal(changed, 1);
  }
  assert.deepEqual(await invariantFingerprint(tx), invariant);
  assert.deepEqual(await auditFingerprint(tx, actor), audit);
  const [events] = await tx.$queryRawUnsafe(
    'SELECT count(*)::int AS count FROM domain_audit_events WHERE "actorId"=$1',
    actor,
  );
  assert.equal(events.count, journal.length);
}
function updateState(filename, state, changes) {
  const text = fs.readFileSync(filename, "utf8");
  const next = { ...state, ...changes, updatedAt: new Date().toISOString() };
  atomicReplace(filename, JSON.stringify(next, null, 2) + "\n", sha256(text));
  Object.assign(state, next);
}
async function assertLocalApiStopped() {
  for (const host of ["127.0.0.1", "::1"]) {
    const open = await new Promise((resolve, reject) => {
      const socket = net.connect({ host, port: 4000 });
      socket.setTimeout(2000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", (error) => {
        socket.destroy();
        if (["ECONNREFUSED", "EAFNOSUPPORT"].includes(error.code))
          resolve(false);
        else reject(error);
      });
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Cannot confirm local API is stopped"));
      });
    });
    assert.equal(open, false, "Stop the local API before cutover");
  }
}
async function fence(client, targets) {
  await assertLiveTarget(client, targets);
  const [original] = await client.$queryRawUnsafe(
    "SELECT rolcanlogin AS login FROM pg_roles WHERE rolname=$1",
    "school_erp_runtime",
  );
  assert.equal(
    original.login,
    true,
    "Runtime was already fenced; inspect the existing maintenance owner",
  );
  await client.$executeRawUnsafe('ALTER ROLE "school_erp_runtime" NOLOGIN');
  await assertLiveTarget(client, targets, true);
  await client.$queryRawUnsafe(
    "SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE datname=current_database() AND usename=$1 AND pid<>pg_backend_pid()",
    "school_erp_runtime",
  );
  const [others] = await client.$queryRawUnsafe(
    "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND usename IN ($1,$2)",
    decodeURIComponent(targets.owner.username),
    "school_erp_runtime",
  );
  assert.equal(others.count, 0, "Other ERP operator/runtime clients remain");
}

function deploymentReady(report, state, checkpoint) {
  assert.equal(report.stateId, state.id);
  assert.equal(report.vmHost, "school-erp-staging");
  for (const name of [
    "apiImageBuilt",
    "webImageBuilt",
    "storageConnectivityVerified",
    "applicationServicesStopped",
    "privateConfigurationStaged",
    "composeConfigurationValidated",
    "productionDependencyAuditPassed",
  ])
    assert.equal(report[name], true);
  assert.equal(report.cloudConfigurationSha256, sha256(checkpoint.cloud));
  freshTimestamp(report.verifiedAt, 60 * 60 * 1000);
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      backup: { type: "string" },
      "recovery-copy": { type: "string" },
      state: { type: "string" },
      "restore-report": { type: "string" },
      "deployment-report": { type: "string" },
      "maintenance-confirmed": { type: "boolean", default: false },
    },
  });
  if (
    !["prepare", "rehearse", "apply", "rollback", "release"].includes(
      values.mode,
    )
  )
    throw new Error("Select an explicit cutover mode");
  const env = loadEnvironment(),
    targets = neonTargets(env.source, env.runtime);
  const key = backupKey(env.source);
  const appCrypto = require(
    path.join(root, "apps/api/dist/core/security/crypto.util.js"),
  );
  const { PrismaClient } = require(
    require.resolve("@prisma/client", { paths: [path.join(root, "apps/api")] }),
  );
  let client, runtimeClient;
  const keys = oldKeys(env.source, appCrypto);
  try {
    if (values.mode === "prepare") {
      phase = "verify_backup_custody";
      compatibleConfiguration(env.source, env.runtime, appCrypto);
      const archive = fs.realpathSync(path.resolve(root, values.backup || ""));
      const directory = fs.realpathSync(path.join(root, "backups/neon"));
      assert.equal(path.dirname(archive), directory);
      assert.match(path.basename(archive), /^erp-[0-9TZ-]+\.dump\.enc$/);
      const manifest = JSON.parse(fs.readFileSync(archive + ".json"));
      const receipt = JSON.parse(
        fs.readFileSync(path.resolve(root, values["recovery-copy"] || "")),
      );
      const archiveHash = recoveryCopy(archive, manifest, receipt);
      decryptArchive(fs.readFileSync(archive), key).fill(0);
      freshTimestamp(manifest.createdAt, 4 * 60 * 60 * 1000);
      phase = "read_live_preparation_snapshot";
      client = new PrismaClient({ datasourceUrl: targets.owner.href, log: [] });
      runtimeClient = new PrismaClient({
        datasourceUrl: targets.app.href,
        log: [],
      });
      await inspectCutover(client, runtimeClient, targets, keys);
      const before = await snapshot(
        client,
        (tx) => assertLiveTarget(tx, targets),
        true,
      );
      assert.deepEqual(
        before.checksums,
        manifest.tables,
        "Live data changed after backup; create and independently copy a fresh archive",
      );
      const secrets = rotationSecrets(env.source),
        directoryOut = privateDirectory();
      const files = Object.fromEntries(
        ENV_FILES.map((name) => [
          name,
          {
            original: env.files[name],
            next: encryptionEnvironment(env.files[name], secrets),
          },
        ]),
      );
      const cloud = cloudRuntime(env.runtime, secrets);
      const checkpoint = {
        version: 1,
        targetHost: targets.owner.hostname,
        before,
        secrets,
        files,
        cloud,
        archiveHash,
      };
      saveCheckpoint(
        path.join(directoryOut, "checkpoint.enc"),
        checkpoint,
        key,
      );
      writeDurable(path.join(directoryOut, "cloud-runtime.env"), cloud);
      const state = {
        id: crypto.randomUUID(),
        phase: "prepared",
        createdAt: new Date().toISOString(),
        targetHost: targets.owner.hostname,
        database: "school_erp",
        archiveHash,
        liveChangesApplied: false,
        productionAccepted: false,
      };
      const filename = path.join(directoryOut, "cutover.json");
      writeDurable(filename, JSON.stringify(state, null, 2) + "\n");
      console.log(
        JSON.stringify(
          {
            prepared: true,
            liveChangesApplied: false,
            state: filename,
            privateCloudConfiguration: path.join(
              directoryOut,
              "cloud-runtime.env",
            ),
            next: "Rehearse locally and stage/verify the VM configuration before apply",
          },
          null,
          2,
        ),
      );
      return;
    }
    const filename = privateState(root, values.state),
      directory = path.dirname(filename);
    const state = JSON.parse(fs.readFileSync(filename));
    const checkpoint = readCheckpoint(
      path.join(directory, "checkpoint.enc"),
      key,
    );
    assert.equal(checkpoint.version, 1);
    assert.equal(checkpoint.targetHost, targets.owner.hostname);
    assert.equal(state.targetHost, targets.owner.hostname);
    assert.equal(state.archiveHash, checkpoint.archiveHash);
    const newKey = keyFromValue(checkpoint.secrets.PII_ENCRYPTION_KEY);
    try {
      if (values.mode === "rehearse") {
        phase = "local_commit_and_rollback_rehearsal";
        assert.equal(state.phase, "prepared");
        assert.equal(
          fs.existsSync(path.join(directory, "rehearsal.json")),
          false,
        );
        const report = restoreReport(values["restore-report"]);
        const url = restoredTarget(env.source.LOCAL_DATABASE_URL, report);
        client = new PrismaClient({ datasourceUrl: url.href, log: [] });
        const guard = (tx) => assertTargetDatabase(tx, report.restoredDatabase);
        const before = await snapshot(client, guard, true);
        assert.deepEqual(before.checksums, checkpoint.before.checksums);
        let rotation;
        try {
          rotation = await client.$transaction(
            (tx) =>
              rotateVerifiedFields(
                tx,
                {
                  database: report.restoredDatabase,
                  oldKeys: keys,
                  newKey,
                  expectedFingerprint: before.encrypted,
                  expectedInvariant: before.invariant,
                },
                { assertTarget: guard, operation },
              ),
            { isolationLevel: "Serializable", timeout: 180000 },
          );
          const after = await snapshot(client, guard);
          assert.deepEqual(after.invariant, before.invariant);
          const authentication = await withEncryptionEnvironment(
            { NODE_ENV: "production", ...checkpoint.secrets },
            () =>
              verifyAuth(
                client,
                report.restoredDatabase,
                checkpoint.secrets,
                env.source,
                appCrypto,
              ),
          );
          await client.$transaction(
            (tx) => restoreJournal(tx, rotation.journal, guard),
            { isolationLevel: "Serializable", timeout: 180000 },
          );
          const restored = await snapshot(client, guard);
          assert.deepEqual(restored.invariant, before.invariant);
          assert.equal(restored.encrypted, before.encrypted);
          for (const name of ENV_FILES)
            assert.equal(
              sha256(fs.readFileSync(path.join(root, name))),
              sha256(checkpoint.files[name].original),
            );
          const evidence = {
            verifiedAt: new Date().toISOString(),
            localCopyOnly: true,
            stateId: state.id,
            archiveHash: state.archiveHash,
            fieldsRekeyed: rotation.journal.length,
            committedLocalRotation: true,
            originalCiphertextRestored: true,
            businessDataPreserved: true,
            authentication,
            liveChangesApplied: false,
          };
          writeDurable(
            path.join(directory, "rehearsal.json"),
            JSON.stringify(evidence, null, 2) + "\n",
          );
          console.log(JSON.stringify(evidence, null, 2));
        } catch (error) {
          // Keep the local test copy/artifacts for inspection; never guess a
          // source key or automatically change the live database on failure.
          throw error;
        }
        return;
      }
      phase = "verify_maintenance_and_deployment_gates";
      assert.equal(values["maintenance-confirmed"], true);
      await assertLocalApiStopped();
      const rehearsal = JSON.parse(
        fs.readFileSync(path.join(directory, "rehearsal.json")),
      );
      assert.equal(rehearsal.stateId, state.id);
      assert.equal(rehearsal.originalCiphertextRestored, true);
      client = new PrismaClient({ datasourceUrl: targets.owner.href, log: [] });
      if (values.mode === "apply") {
        assert.equal(state.phase, "prepared");
        const deployment = JSON.parse(
          fs.readFileSync(
            path.resolve(root, values["deployment-report"] || ""),
          ),
        );
        deploymentReady(deployment, state, checkpoint);
        for (const name of ENV_FILES)
          assert.equal(
            sha256(fs.readFileSync(path.join(root, name))),
            sha256(checkpoint.files[name].original),
          );
        const before = await snapshot(
          client,
          (tx) => assertLiveTarget(tx, targets),
          true,
        );
        assert.deepEqual(before.checksums, checkpoint.before.checksums);
        updateState(filename, state, { phase: "fence_requested" });
        phase = "fence_runtime_role";
        await fence(client, targets);
        updateState(filename, state, { phase: "fenced" });
        phase = "commit_live_ciphertext_rotation";
        const rotation = await client.$transaction(
          async (tx) => {
            const result = await rotateVerifiedFields(
              tx,
              {
                database: "school_erp",
                oldKeys: keys,
                newKey,
                expectedFingerprint: checkpoint.before.encrypted,
                expectedInvariant: checkpoint.before.invariant,
              },
              {
                assertTarget: () => assertLiveTarget(tx, targets, true),
                operation,
              },
            );
            saveCheckpoint(
              path.join(directory, "live-journal.enc"),
              result.journal,
              key,
            );
            return result;
          },
          { isolationLevel: "Serializable", timeout: 180000 },
        );
        updateState(filename, state, {
          phase: "rotated",
          fieldsRekeyed: rotation.journal.length,
          liveChangesApplied: true,
        });
        phase = "activate_matching_local_configuration";
        for (const name of ENV_FILES)
          atomicReplace(
            path.join(root, name),
            checkpoint.files[name].next,
            sha256(checkpoint.files[name].original),
          );
        const after = await snapshot(client, (tx) =>
          assertLiveTarget(tx, targets, true),
        );
        assert.deepEqual(after.invariant, checkpoint.before.invariant);
        await client.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            await assertLiveTarget(tx, targets, true);
            for (const entry of await encryptedInventory(tx))
              for (const row of entry.rows)
                decryptField(row[entry.field], [newKey]).fill(0);
          },
          { timeout: 30000 },
        );
        updateState(filename, state, {
          phase: "configured",
          localConfigurationActivated: true,
          runtimeRoleFenced: true,
          rotatedFingerprint: after.encrypted,
        });
        console.log(
          JSON.stringify(
            {
              liveCiphertextAndLocalConfigurationMigrated: true,
              runtimeRoleFenced: true,
              fieldsRekeyed: rotation.journal.length,
              usersPreserved: after.users,
              mfaUsersPreserved: after.mfaUsers,
              next: "Verify VM configuration, then explicitly release the runtime role; do not start with old keys",
              state: filename,
            },
            null,
            2,
          ),
        );
        return;
      }
      if (values.mode === "rollback") {
        assert.ok(
          ["fence_requested", "fenced", "rotated", "configured"].includes(
            state.phase,
          ),
        );
        await assertLiveTarget(client, targets, true);
        if (fs.existsSync(path.join(directory, "live-journal.enc"))) {
          const journal = readCheckpoint(
            path.join(directory, "live-journal.enc"),
            key,
          );
          const current = await client.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
              return encryptedInventory(tx);
            },
            { timeout: 30000 },
          );
          const records = current.flatMap((entry) =>
            entry.rows.map((row) => ({
              table: entry.table,
              field: entry.field,
              id: row.id,
              value: row[entry.field],
            })),
          );
          const allBefore = journal.every((row) =>
            records.some(
              (r) =>
                r.table === row.table &&
                r.id === row.id &&
                r.field === row.field &&
                r.value === row.before,
            ),
          );
          const allAfter = journal.every((row) =>
            records.some(
              (r) =>
                r.table === row.table &&
                r.id === row.id &&
                r.field === row.field &&
                r.value === row.after,
            ),
          );
          assert.ok(
            allBefore || allAfter,
            "Mixed or changed ciphertext; preserve maintenance and inspect",
          );
          if (allAfter && journal.length)
            await client.$transaction(
              (tx) =>
                restoreJournal(tx, journal, (tx) =>
                  assertLiveTarget(tx, targets, true),
                ),
              { isolationLevel: "Serializable", timeout: 180000 },
            );
        }
        const restored = await snapshot(client, (tx) =>
          assertLiveTarget(tx, targets, true),
        );
        assert.equal(restored.encrypted, checkpoint.before.encrypted);
        assert.deepEqual(restored.invariant, checkpoint.before.invariant);
        for (const name of ENV_FILES) {
          const current = fs.readFileSync(path.join(root, name));
          if (sha256(current) === sha256(checkpoint.files[name].next))
            atomicReplace(
              path.join(root, name),
              checkpoint.files[name].original,
              sha256(current),
            );
          else
            assert.equal(
              sha256(current),
              sha256(checkpoint.files[name].original),
            );
        }
        updateState(filename, state, {
          phase: "rolled_back",
          liveChangesApplied: false,
          runtimeRoleFenced: true,
        });
        console.log(
          JSON.stringify(
            {
              pairedRollbackVerified: true,
              runtimeRoleFenced: true,
              next: "Keep new cloud services stopped; operator must verify the restored original deployment before re-enabling runtime login",
            },
            null,
            2,
          ),
        );
        return;
      }
      if (values.mode === "release") {
        assert.equal(state.phase, "configured");
        deploymentReady(
          JSON.parse(
            fs.readFileSync(
              path.resolve(root, values["deployment-report"] || ""),
            ),
          ),
          state,
          checkpoint,
        );
        await assertLiveTarget(client, targets, true);
        for (const name of ENV_FILES)
          assert.equal(
            sha256(fs.readFileSync(path.join(root, name))),
            sha256(checkpoint.files[name].next),
          );
        const after = await snapshot(client, (tx) =>
          assertLiveTarget(tx, targets, true),
        );
        assert.deepEqual(after.invariant, checkpoint.before.invariant);
        assert.equal(
          after.encrypted,
          state.rotatedFingerprint,
          "Ciphertext changed after configured-state verification",
        );
        // Release is a separate explicit operation after the matching VM
        // configuration is verified; it never starts processes automatically.
        await client.$executeRawUnsafe('ALTER ROLE "school_erp_runtime" LOGIN');
        updateState(filename, state, {
          phase: "released",
          runtimeRoleFenced: false,
          productionAccepted: false,
        });
        console.log(
          JSON.stringify(
            {
              runtimeRoleReleased: true,
              applicationStartAndBrowserAcceptancePending: true,
              productionAccepted: false,
            },
            null,
            2,
          ),
        );
      }
    } finally {
      newKey.fill(0);
    }
  } finally {
    key.fill(0);
    for (const k of keys) k.fill(0);
    if (client) await client.$disconnect();
    if (runtimeClient) await runtimeClient.$disconnect();
  }
}
module.exports = {
  assertLiveTarget,
  snapshot,
  restoreJournal,
  assertLocalApiStopped,
  fence,
  deploymentReady,
  freshTimestamp,
};
if (require.main === module)
  main().catch((error) => {
    console.error(
      "Controlled cutover failed or was refused. Do not start/restart applications or change keys by hand. Inspect the private state/checkpoint; a live failure may deliberately leave the runtime role fenced.",
    );
    console.error(
      JSON.stringify({
        phase,
        code: /^[A-Z0-9_]+$/.test(error.code || "")
          ? error.code
          : "CHECK_FAILED",
        databaseCode: /^[0-9A-Z]{5}$/.test(error.meta?.code || "")
          ? error.meta.code
          : undefined,
      }),
    );
    process.exitCode = 1;
  });
