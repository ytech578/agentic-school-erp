param(
  [Parameter(Mandatory = $true)][string]$SourceDbArn,
  [Parameter(Mandatory = $true)][string]$PrimaryRegion,
  [Parameter(Mandatory = $true)][string]$DrRegion,
  [Parameter(Mandatory = $true)][string]$PrimaryBucket,
  [Parameter(Mandatory = $true)][string]$DrBucket
)

$ErrorActionPreference = 'Stop'

$primary = aws rds describe-db-instance-automated-backups `
  --db-instance-arn $SourceDbArn `
  --region $PrimaryRegion `
  --query 'DBInstanceAutomatedBackups[0].{Status:Status,Window:RestoreWindow,Retention:BackupRetentionPeriod}' `
  --output json | ConvertFrom-Json
if (-not $primary -or $primary.Status -ne 'active') {
  throw 'Primary RDS automated backups are not active.'
}

$replica = aws rds describe-db-instance-automated-backups `
  --db-instance-arn $SourceDbArn `
  --region $DrRegion `
  --query 'DBInstanceAutomatedBackups[0].{Status:Status,Window:RestoreWindow,Retention:BackupRetentionPeriod}' `
  --output json | ConvertFrom-Json
if (-not $replica -or $replica.Status -ne 'active') {
  throw 'Cross-region RDS automated backup replication is not active.'
}

$primaryVersioning = aws s3api get-bucket-versioning --bucket $PrimaryBucket --region $PrimaryRegion | ConvertFrom-Json
$drVersioning = aws s3api get-bucket-versioning --bucket $DrBucket --region $DrRegion | ConvertFrom-Json
if ($primaryVersioning.Status -ne 'Enabled' -or $drVersioning.Status -ne 'Enabled') {
  throw 'Document bucket versioning is not enabled in both regions.'
}

[pscustomobject]@{
  PrimaryRdsStatus = $primary.Status
  DrRdsStatus = $replica.Status
  PrimaryRetentionDays = $primary.Retention
  DrRetentionDays = $replica.Retention
  PrimaryBucketVersioning = $primaryVersioning.Status
  DrBucketVersioning = $drVersioning.Status
} | Format-List
