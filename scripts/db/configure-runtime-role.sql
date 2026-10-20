\set ON_ERROR_STOP on

-- Run as the database owner after Prisma migrations:
-- psql "$MIGRATION_DATABASE_URL" \
--   --set=app_runtime_role=school_erp_runtime \
--   --set=app_runtime_password='load-from-your-secret-manager' \
--   --set=enable_rds_iam=true \
--   --set=database_name=school_erp -f scripts/db/configure-runtime-role.sql
-- Authentication should use RDS IAM or a secret managed outside this file.

\if :{?app_runtime_role}
\else
  \echo 'app_runtime_role is required'
  \quit 2
\endif

\if :{?database_name}
\else
  \echo 'database_name is required'
  \quit 2
\endif

SELECT format('CREATE ROLE %I LOGIN NOBYPASSRLS', :'app_runtime_role')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_runtime_role'
) \gexec

SELECT format('ALTER ROLE %I NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'app_runtime_role') \gexec
\if :{?app_runtime_password}
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_runtime_role', :'app_runtime_password') \gexec
\endif
\if :{?enable_rds_iam}
SELECT format('GRANT rds_iam TO %I', :'app_runtime_role')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rds_iam') \gexec
\endif
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'database_name', :'app_runtime_role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public, app_security TO %I', :'app_runtime_role') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_runtime_role') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_runtime_role') \gexec
SELECT format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_security TO %I', :'app_runtime_role') \gexec
-- Auditing is performed by SECURITY DEFINER triggers, never directly by the API.
SELECT format('REVOKE INSERT, UPDATE, DELETE ON public.domain_audit_events FROM %I', :'app_runtime_role')
WHERE to_regclass('public.domain_audit_events') IS NOT NULL \gexec
SELECT format('REVOKE ALL ON public._prisma_migrations FROM %I', :'app_runtime_role')
WHERE to_regclass('public._prisma_migrations') IS NOT NULL \gexec
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'app_runtime_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', :'app_runtime_role') \gexec

\echo 'Runtime role configured. Set DATABASE_URL to this role and DATABASE_RLS_ENABLED=true.'
