variable "build_id" {
  description = "Unique Jenkins build number used to name short-lived lab resources."
  type        = string
}

variable "public_key_path" {
  description = "Path to the ephemeral SSH public key created by the Jenkins build."
  type        = string
  default     = "../ansible/.lab8_key.pub"
}

variable "ami_id" {
  description = "LocalEmu Docker-backed Ubuntu AMI identifier."
  type        = string
  default     = "ami-ubuntu-22.04"
}

variable "image_ref" {
  description = "Immutable TaskFlow API image built and scanned in the Lab 7 pipeline stage."
  type        = string
}
