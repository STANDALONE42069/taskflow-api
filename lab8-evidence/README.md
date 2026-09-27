# Lab 8 evidence

The Jenkins branch build archives this directory and the saved binary Terraform
plan (`infra/terraform/tfplan`). The pipeline pauses at **Approval — Terraform
Apply** so a human can review the plan summary before any resource is created.

Expected artifacts after the approval-gated build completes:

- `terraform-plan-summary.txt`: proposed resource changes shown at the approval gate.
- `applied-instance.txt`: emulated instance ID and private address after approval.
- `application-health.txt`: Ansible `/health` verification using the Lab 7 image.
- `security-reports/tfsec-before.txt` and `tfsec-after.txt`.
- `security-reports/checkov-before.txt` and `checkov-after.txt`.
- `security-reports/state-after-destroy.txt`: empty Terraform state / zero managed resources.

Terraform state stays in LocalEmu's S3-compatible backend and is not committed or
archived. Temporary private SSH keys and generated inventory are removed at the
end of the pipeline.
