import { assertDeploymentPolicy } from './deployment-policy';
describe('School deployment boundaries', () => {
  const onsite = {
    NODE_ENV: 'production',
    ERP_DEPLOYMENT_MODE: 'on-premises',
    DATABASE_URL: 'postgresql://runtime:password@pgbouncer/erp',
    STORAGE_DRIVER: 'local',
  };
  it('allows a school-owned database and filesystem', () =>
    expect(() => assertDeploymentPolicy(onsite)).not.toThrow());
  it('does not silently retain Neon for an on-premises school', () =>
    expect(() =>
      assertDeploymentPolicy({
        ...onsite,
        DATABASE_URL: 'postgresql://runtime:password@db.neon.tech/erp',
      }),
    ).toThrow('local database'));
  it('blocks unapproved external AI and cloud files for an onsite deployment', () => {
    expect(() =>
      assertDeploymentPolicy({ ...onsite, GEMINI_API_KEY: 'configured' }),
    ).toThrow('school approval');
    expect(() =>
      assertDeploymentPolicy({ ...onsite, STORAGE_DRIVER: 's3' }),
    ).toThrow('school-controlled');
  });
  it('does not label a cloud database with workstation files as production-ready', () =>
    expect(() =>
      assertDeploymentPolicy({ ...onsite, ERP_DEPLOYMENT_MODE: 'cloud' }),
    ).toThrow('private object storage'));
  it('requires a production deployment decision and permits the current development setup', () => {
    expect(() => assertDeploymentPolicy({ NODE_ENV: 'production' })).toThrow(
      'explicitly',
    );
    expect(() =>
      assertDeploymentPolicy({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });
});
