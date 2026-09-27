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

LocalEmu's `ami-ubuntu-22.04` shortcut works with direct `RunInstances`, but
the AWS Terraform provider first calls `DescribeImages` and LocalEmu does not
list that shortcut in its AMI catalog. The pipeline therefore selects a valid
catalog entry (`ami-785db401`); LocalEmu's Docker manager resolves catalog
entries without a custom mapping to its managed Ubuntu 22.04 base image. That
base image uses `root` for SSH. This AMI ID and user choice are for LocalEmu;
they are not a real AWS deployment configuration.

The apply creates an Internet Gateway and a default route so Ansible can
install Python, Node.js, and Docker from Ubuntu repositories. The security
group limits outbound traffic to DNS, HTTP, and HTTPS. Terraform removes the
route, gateway, and all other managed resources after the health check.
LocalEmu creates its VPC Docker bridge only when the first EC2 instance starts.
The plan therefore creates a small, short-lived `network_bootstrap` instance
before attaching the Internet Gateway; this lets LocalEmu switch the bridge to
internet-enabled mode before it starts the application host.

The Ansible controller installs the constrained Python `requests` requirement and
uses the pinned `community.docker` collection. The collection's Docker modules
run on the controller and require Requests there, so the pipeline installs it
in the same container that runs `ansible-playbook`.
LocalEmu models EC2 as a container and does not put a Docker daemon inside
that container, so the controller starts the API container through its Docker
socket in the EC2 container's network namespace. Ansible installs Python,
Node.js, and the Docker CLI on the guest.

The before/after scans use an isolated deliberately vulnerable security-group
fixture, then scan the deployable configuration. The deployable security group
allows inbound SSH and API traffic only from the VPC. Outbound access is limited
to DNS and HTTP/HTTPS so Ansible can install Ubuntu packages and pull the already
scanned Lab 7 image; tfsec marks these three narrowly scoped public egress rules
as reviewed exceptions with an expiration date. Both EC2 instances have an
empty IAM role (no attached permissions), IMDSv2, encrypted storage, and EBS
optimization. Detailed monitoring is disabled because LocalEmu does not
implement the `MonitorInstances` API.
