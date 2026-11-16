const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertLiveTarget,
  fence,
  deploymentReady,
  freshTimestamp,
} = require("./migrate-encryption-neon");
const { sha256 } = require("./cutover-state");
const targets = {
  owner: new URL(
    "postgresql://school_erp_owner:synthetic@ep-test.neon.tech/school_erp?sslmode=require",
  ),
  app: new URL(
    "postgresql://school_erp_runtime:synthetic@ep-test-pooler.neon.tech/school_erp?sslmode=require",
  ),
};

function database(overrides = {}) {
  let login = overrides.login ?? true;
  const mutations = [];
  return {
    mutations,
    $queryRawUnsafe: async (sql, ...values) => {
      if (sql.includes("current_database() AS name"))
        return [
          {
            name: overrides.name || "school_erp",
            role: overrides.role || "school_erp_owner",
          },
        ];
      if (sql.includes("FROM pg_roles"))
        return [
          {
            login,
            superuser: false,
            bypass: false,
            ...overrides,
            ...(overrides.login === undefined ? { login } : {}),
          },
        ];
      if (sql.includes("FROM pg_class")) {
        assert.deepEqual(values, ["school_erp_runtime"]);
        return [{ count: overrides.ownership || 0 }];
      }
      if (sql.includes("pg_terminate_backend")) {
        assert.deepEqual(values, ["school_erp_runtime"]);
        assert.match(sql, /datname=current_database\(\)/);
        mutations.push("terminate scoped ERP runtime sessions");
        return [];
      }
      if (sql.includes("pg_stat_activity"))
        return [{ count: overrides.otherClients || 0 }];
      throw new Error("Unexpected synthetic SQL");
    },
    $executeRawUnsafe: async (sql) => {
      mutations.push(sql);
      assert.equal(sql, 'ALTER ROLE "school_erp_runtime" NOLOGIN');
      login = false;
    },
  };
}

test("live guard checks exact database, operator, runtime role and explicit fence", async () => {
  await assert.doesNotReject(assertLiveTarget(database(), targets));
  await assert.doesNotReject(
    assertLiveTarget(database({ login: false }), targets, true),
  );
  for (const override of [
    { name: "another_database" },
    { role: "postgres" },
    { superuser: true },
    { bypass: true },
    { ownership: 1 },
  ])
    await assert.rejects(assertLiveTarget(database(override), targets));
  await assert.rejects(assertLiveTarget(database(), targets, true));
  await assert.rejects(
    assertLiveTarget(database(), {
      ...targets,
      app: new URL(
        "postgresql://another_role:synthetic@ep-test.neon.tech/school_erp",
      ),
    }),
  );
});

test("freshness guards reject future, invalid and stale evidence", () => {
  assert.doesNotThrow(() =>
    freshTimestamp(new Date(Date.now() - 1000).toISOString(), 60000),
  );
  for (const time of [
    "invalid",
    new Date(Date.now() + 60000).toISOString(),
    new Date(Date.now() - 120000).toISOString(),
  ])
    assert.throws(() => freshTimestamp(time, 60000));
});

test("fence blocks runtime logins before terminating only same-database ERP runtime clients", async () => {
  const db = database();
  await fence(db, targets);
  assert.deepEqual(db.mutations, [
    'ALTER ROLE "school_erp_runtime" NOLOGIN',
    "terminate scoped ERP runtime sessions",
  ]);
});

test("fence refuses another maintenance owner or unexpected operator connection", async () => {
  const alreadyFenced = database({ login: false });
  await assert.rejects(fence(alreadyFenced, targets));
  assert.deepEqual(alreadyFenced.mutations, []);
  await assert.rejects(fence(database({ otherClients: 1 }), targets));
});

test("deployment gates require fresh, matching private configuration and all measured readiness checks", () => {
  const state = { id: "synthetic-cutover" },
    checkpoint = { cloud: "synthetic cloud configuration" };
  const report = {
    stateId: state.id,
    verifiedAt: new Date().toISOString(),
    vmHost: "school-erp-staging",
    apiImageBuilt: true,
    webImageBuilt: true,
    storageConnectivityVerified: true,
    applicationServicesStopped: true,
    privateConfigurationStaged: true,
    composeConfigurationValidated: true,
    productionDependencyAuditPassed: true,
    cloudConfigurationSha256: sha256(checkpoint.cloud),
  };
  assert.doesNotThrow(() => deploymentReady(report, state, checkpoint));
  for (const override of [
    { stateId: "other cutover" },
    { vmHost: "another-server" },
    { apiImageBuilt: false },
    { webImageBuilt: false },
    { storageConnectivityVerified: false },
    { applicationServicesStopped: false },
    { privateConfigurationStaged: false },
    { composeConfigurationValidated: false },
    { productionDependencyAuditPassed: false },
    { cloudConfigurationSha256: "wrong" },
    { verifiedAt: "invalid" },
    { verifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  ])
    assert.throws(() =>
      deploymentReady({ ...report, ...override }, state, checkpoint),
    );
});
