variable "name_prefix" {
  type        = string
  description = "Globally unique lowercase workload prefix."
  default     = "agentic-school-erp-prod"
}

variable "primary_region" {
  type    = string
  default = "ap-south-1"
}
variable "dr_region" {
  type    = string
  default = "ap-southeast-1"
}
variable "vpc_id" { type = string }
variable "database_subnet_ids" { type = list(string) }
variable "application_security_group_id" { type = string }
variable "database_name" {
  type    = string
  default = "school_erp"
}
variable "database_master_username" {
  type    = string
  default = "school_erp_owner"
}
variable "postgres_engine_version" {
  type    = string
  default = "16"
}
variable "database_instance_class" {
  type    = string
  default = "db.r6g.large"
}
variable "backup_retention_days" {
  type    = number
  default = 35
}
variable "document_retention_days" {
  type    = number
  default = 2555
}
variable "environment" {
  type    = string
  default = "production"
}

locals {
  tags = {
    Application       = "agentic-school-erp"
    Environment       = var.environment
    ManagedBy         = "terraform"
    DataClassification = "confidential"
  }
}
