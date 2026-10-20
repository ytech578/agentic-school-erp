resource "aws_kms_key" "documents" {
  description             = "Primary document encryption for ${var.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_key" "documents_dr" {
  provider                = aws.dr
  description             = "DR document encryption for ${var.name_prefix}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "documents" {
  bucket              = "${var.name_prefix}-documents-${data.aws_caller_identity.current.account_id}-${var.primary_region}"
  object_lock_enabled = true
}

resource "aws_s3_bucket" "documents_dr" {
  provider            = aws.dr
  bucket              = "${var.name_prefix}-documents-${data.aws_caller_identity.current.account_id}-${var.dr_region}"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "documents_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.documents_dr.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.documents.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.documents_dr.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.documents_dr.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "documents_dr" {
  provider                = aws.dr
  bucket                  = aws_s3_bucket.documents_dr.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.document_retention_days
    }
  }
}

resource "aws_s3_bucket_object_lock_configuration" "documents_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.documents_dr.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.document_retention_days
    }
  }
}

resource "aws_iam_role" "replication" {
  name = "${var.name_prefix}-document-replication"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "s3.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "replication" {
  role = aws_iam_role.replication.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = [aws_s3_bucket.documents.arn]
      },
      {
        Effect = "Allow"
        Action = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging", "s3:GetObjectRetention", "s3:GetObjectLegalHold"]
        Resource = ["${aws_s3_bucket.documents.arn}/*"]
      },
      {
        Effect = "Allow"
        Action = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags", "s3:ObjectOwnerOverrideToBucketOwner"]
        Resource = ["${aws_s3_bucket.documents_dr.arn}/*"]
      },
      {
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = [aws_kms_key.documents.arn, aws_kms_key.documents_dr.arn]
      }
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "documents" {
  depends_on = [aws_s3_bucket_versioning.documents, aws_s3_bucket_versioning.documents_dr]
  role       = aws_iam_role.replication.arn
  bucket     = aws_s3_bucket.documents.id

  rule {
    id       = "cross-region-disaster-recovery"
    status   = "Enabled"
    filter {}
    delete_marker_replication { status = "Enabled" }
    destination {
      bucket        = aws_s3_bucket.documents_dr.arn
      storage_class = "STANDARD_IA"
      encryption_configuration { replica_kms_key_id = aws_kms_key.documents_dr.arn }
    }
    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
  }
}
