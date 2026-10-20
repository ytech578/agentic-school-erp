param(
  [Parameter(Mandatory = $true)][string]$SourceDbIdentifier,
  [Parameter(Mandatory = $true)][string]$TargetDbIdentifier,
  [Parameter(Mandatory = $true)][string]$Region,
  [Parameter(Mandatory = $true)][string]$DbSubnetGroup,
  [Parameter(Mandatory = $true)][string[]]$VpcSecurityGroupIds,
  [string]$DbInstanceClass = 'db.r6g.large',
  [string]$RestoreTime
)

$ErrorActionPreference = 'Stop'

$existing = aws rds describe-db-instances `
  --db-instance-identifier $TargetDbIdentifier `
  --region $Region `
  --query 'DBInstances[0].DBInstanceIdentifier' `
  --output text 2>$null

if ($LASTEXITCODE -eq 0 -and $existing -eq $TargetDbIdentifier) {
  throw "Target DB instance '$TargetDbIdentifier' already exists. Choose a unique drill identifier."
}

$arguments = @(
  'rds', 'restore-db-instance-to-point-in-time',
  '--source-db-instance-identifier', $SourceDbIdentifier,
  '--target-db-instance-identifier', $TargetDbIdentifier,
  '--db-instance-class', $DbInstanceClass,
  '--db-subnet-group-name', $DbSubnetGroup,
  '--vpc-security-group-ids'
) + $VpcSecurityGroupIds + @(
  '--no-publicly-accessible',
  '--deletion-protection',
  '--copy-tags-to-snapshot',
  '--region', $Region
)

if ($RestoreTime) {
  $arguments += @('--restore-time', $RestoreTime)
} else {
  $arguments += '--use-latest-restorable-time'
}

& aws @arguments
if ($LASTEXITCODE -ne 0) { throw 'RDS point-in-time restore request failed.' }

aws rds wait db-instance-available `
  --db-instance-identifier $TargetDbIdentifier `
  --region $Region
if ($LASTEXITCODE -ne 0) { throw 'Restored database did not become available.' }

aws rds describe-db-instances `
  --db-instance-identifier $TargetDbIdentifier `
  --region $Region `
  --query 'DBInstances[0].{Identifier:DBInstanceIdentifier,Endpoint:Endpoint.Address,Status:DBInstanceStatus,Encrypted:StorageEncrypted,LatestRestorableTime:LatestRestorableTime}' `
  --output table

Write-Host 'Restore created successfully. Validate schema, RLS, row counts, and checksums before any promotion.'
Write-Host 'This script intentionally does not delete the restored instance.'
