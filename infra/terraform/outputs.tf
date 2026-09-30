output "instance_address" {
  description = "Private VPC address of the short-lived TaskFlow host."
  value       = aws_instance.taskflow.private_ip
}

output "instance_id" {
  description = "LocalEmu EC2 instance identifier."
  value       = aws_instance.taskflow.id
}

output "application_image" {
  description = "Exact immutable application image pulled by Ansible."
  value       = var.image_ref
}
