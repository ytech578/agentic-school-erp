/** Deployment boundaries are explicit. No automatic tenant data relocation. */
export function assertDeploymentPolicy(env: NodeJS.ProcessEnv) {
  const mode =
    env.ERP_DEPLOYMENT_MODE ||
    (env.NODE_ENV === 'production' ? '' : 'development');
  if (!['development', 'on-premises', 'cloud'].includes(mode))
    throw new Error(
      'Set ERP_DEPLOYMENT_MODE explicitly to on-premises or cloud for production',
    );
  if (mode === 'development') {
    if (env.NODE_ENV === 'production')
      throw new Error(
        'Production cannot use the development deployment policy',
      );
    return;
  }
  const driver = (
    env.STORAGE_DRIVER ||
    env.STORAGE_PROVIDER ||
    'local'
  ).toLowerCase();
  const database = new URL(env.DATABASE_URL || '');
  if (mode === 'on-premises') {
    const approvedHosts = (
      env.ON_PREMISES_DATABASE_HOSTS || 'localhost,127.0.0.1,postgres,pgbouncer'
    )
      .split(',')
      .map((host) => host.trim());
    if (
      database.hostname.endsWith('.neon.tech') ||
      !approvedHosts.includes(database.hostname)
    )
      throw new Error(
        'On-premises mode requires a school-approved local database host, not a cloud database',
      );
    if (driver !== 'local')
      throw new Error(
        'On-premises mode requires school-controlled local document storage',
      );
    if (env.GEMINI_API_KEY && env.ON_PREMISES_ALLOW_EXTERNAL_AI !== 'true')
      throw new Error(
        'On-premises external AI requires explicit school approval',
      );
  } else if (driver !== 's3' || !(env.S3_BUCKET_NAME || env.AWS_S3_BUCKET)) {
    throw new Error(
      'Cloud mode requires configured private object storage; workstation uploads are not production storage',
    );
  }
}
