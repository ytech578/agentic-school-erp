export interface RuntimeDatabaseRole {
  superuser: boolean;
  bypassRls: boolean;
  ownsTenantTables: boolean;
}

export function assertRestrictedRuntimeRole(
  role: RuntimeDatabaseRole | undefined,
) {
  if (!role || role.superuser || role.bypassRls || role.ownsTenantTables) {
    throw new Error(
      'RLS requires a non-superuser NOBYPASSRLS database role without tenant-table ownership or owner-role membership. Use separate migration credentials.',
    );
  }
}
