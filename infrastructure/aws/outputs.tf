output "database_endpoint" { value = aws_db_instance.primary.endpoint }
output "database_master_secret_arn" { value = aws_db_instance.primary.master_user_secret[0].secret_arn }
output "database_arn" { value = aws_db_instance.primary.arn }
output "document_bucket" { value = aws_s3_bucket.documents.id }
output "document_dr_bucket" { value = aws_s3_bucket.documents_dr.id }
