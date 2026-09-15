variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket_name" {
  description = "Name of the existing S3 bucket for document storage"
  type        = string
}

variable "allowed_origins" {
  description = "Allowed CORS origins for S3 bucket (your app URLs)"
  type        = list(string)
}
