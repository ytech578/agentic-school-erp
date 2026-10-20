resource "aws_kms_key" "database" {
  description             = "Primary RDS encryption for ${var.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "database" {
  name          = "alias/${var.name_prefix}-database"
  target_key_id = aws_kms_key.database.key_id
}

resource "aws_kms_key" "database_dr" {
  provider                = aws.dr
  description             = "DR RDS backup encryption for ${var.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-database"
  subnet_ids = var.database_subnet_ids
}

resource "aws_security_group" "database" {
  name_prefix = "${var.name_prefix}-database-"
  description = "PostgreSQL access from the ERP application only"
  vpc_id      = var.vpc_id

  ingress {
    from_port                = 5432
    to_port                  = 5432
    protocol                 = "tcp"
    security_groups          = [var.application_security_group_id]
    description              = "Application PostgreSQL access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_db_parameter_group" "postgres" {
  name_prefix = "${var.name_prefix}-postgres16-"
  family      = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_db_instance" "primary" {
  identifier                     = "${var.name_prefix}-postgres"
  engine                         = "postgres"
  engine_version                 = var.postgres_engine_version
  instance_class                 = var.database_instance_class
  db_name                        = var.database_name
  username                       = var.database_master_username
  manage_master_user_password    = true
  port                           = 5432
  allocated_storage              = 100
  max_allocated_storage          = 1000
  storage_type                   = "gp3"
  storage_encrypted              = true
  kms_key_id                     = aws_kms_key.database.arn
  multi_az                       = true
  publicly_accessible            = false
  db_subnet_group_name           = aws_db_subnet_group.main.name
  vpc_security_group_ids         = [aws_security_group.database.id]
  parameter_group_name           = aws_db_parameter_group.postgres.name
  backup_retention_period        = var.backup_retention_days
  backup_window                  = "18:00-19:00"
  maintenance_window             = "sun:19:30-sun:20:30"
  copy_tags_to_snapshot          = true
  deletion_protection            = true
  skip_final_snapshot            = false
  final_snapshot_identifier      = "${var.name_prefix}-final"
  auto_minor_version_upgrade     = true
  iam_database_authentication_enabled = true
  performance_insights_enabled   = true
  performance_insights_kms_key_id = aws_kms_key.database.arn
  monitoring_interval            = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  lifecycle { prevent_destroy = true }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.name_prefix}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance_automated_backups_replication" "cross_region" {
  provider               = aws.dr
  source_db_instance_arn = aws_db_instance.primary.arn
  retention_period       = var.backup_retention_days
  kms_key_id             = aws_kms_key.database_dr.arn
}
