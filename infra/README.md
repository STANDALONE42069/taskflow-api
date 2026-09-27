# Lab 8: Infrastructure as Code in the Pipeline

The pipeline uses LocalEmu `1.2.0`, an open-source LocalStack-compatible AWS
emulator, on the Docker network `lab8-network`. This avoids creating billable
resources in a cloud account or requiring an emulator token. Its Docker-backed
EC2 manager runs the short-lived instance as a real container with VPC
networking and security-group filtering. Terraform stores its state in the
S3-compatible bucket `taskflow-lab8-state`; Terraform
state, local provider data, plans, and the temporary SSH key are ignored by Git.

The `codex/lab8-iac` multibranch build runs Terraform format/validate and
`ansible-lint` in parallel, then runs `tfsec` and Checkov against both the
intentional vulnerable baseline and the fixed configuration. It builds and
scans the immutable TaskFlow image in the existing Lab 7 image stage, creates a
Terraform plan, and stops at a Jenkins `input` prompt. Review the displayed
summary before selecting **Approve Terraform Apply**. The following stages
apply the saved plan, configure the instance with Ansible, check `/health`, and
destroy the short-lived resources. A final state check must show zero managed
resources.

The expected instance address is private to the emulated VPC. It is an emulated
EC2 address, not a publicly reachable cloud address.

The before/after scans use an isolated deliberately vulnerable security-group
fixture, then scan the deployable configuration. The deployable security group
allows inbound SSH and API traffic only from the VPC. Outbound access is limited
to DNS and HTTP/HTTPS so Ansible can install Ubuntu packages and pull the already
scanned Lab 7 image; tfsec marks these three narrowly scoped public egress rules
as reviewed exceptions with an expiration date. The EC2 instance has an empty
IAM role (no attached permissions), IMDSv2, encrypted storage, detailed
monitoring, and EBS optimization.
