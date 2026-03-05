# Guardian — инфраструктура как код (AWS). Запуск: terraform init && terraform plan
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Пример: S3 для документов (остальная инфра — VPC, EKS, RDS, ElastiCache — по необходимости)
resource "aws_s3_bucket" "documents" {
  bucket = "guardian-${var.environment}-documents-${data.aws_caller_identity.current.account_id}"

  tags = {
    Environment = var.environment
    Project     = "guardian"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_caller_identity" "current" {}
