terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

provider "aws" {
  region = var.primary_region
  default_tags { tags = local.tags }
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region
  default_tags { tags = local.tags }
}

data "aws_caller_identity" "current" {}
