# AWS production data-resilience stack

This stack provisions the production data plane that the application now expects:

- private Multi-AZ PostgreSQL on RDS with KMS encryption, forced TLS, deletion protection, IAM database authentication, Performance Insights, enhanced monitoring, and 35-day point-in-time recovery;
- encrypted cross-region replication of RDS automated backups;
- private, KMS-encrypted, versioned S3 document buckets in primary and DR regions;
- S3 Object Lock retention and cross-region replication, including legal-hold and retention metadata.

## Provision

1. Configure an encrypted remote Terraform backend with state locking.
2. Copy `terraform.tfvars.example` to a secure environment-specific tfvars file and replace every placeholder.
3. Run `terraform init`, `terraform validate`, `terraform plan -out production.tfplan`, obtain peer approval, then run `terraform apply production.tfplan`.
4. Run Prisma migrations using the database-owner secret produced by RDS.
5. Run `scripts/db/configure-runtime-role.sql` as the owner, passing `enable_rds_iam=true` when IAM database authentication is used. Configure the API `DATABASE_URL` with the non-owner runtime role and set `DATABASE_RLS_ENABLED=true`.
6. Use RDS IAM authentication or a rotated Secrets Manager credential for the runtime role. Never place a database password in Terraform variables or source control.

`prevent_destroy` and RDS deletion protection are intentional. Production destruction requires a separately reviewed change.

## Restore drill

Run `scripts/dr/verify-backups.ps1` daily from a monitored operations runner. At least quarterly, run `scripts/dr/restore-rds-pitr.ps1` with a unique target identifier in an isolated recovery security group. Validate migrations, RLS behavior, tenant row counts, audit-chain continuity, and sampled document checksums. Record actual RPO/RTO and retain the evidence.

The restore script creates a protected database and intentionally does not delete it. Cleanup must be a separately approved operation after evidence is captured.
