resource "aws_security_group" "intentionally_vulnerable_baseline" {
  name        = "lab8-before-fix"
  description = "Deliberately vulnerable baseline used only to demonstrate scanner findings"
  vpc_id      = "vpc-baseline"

  ingress {
    description = "Intentional baseline defect: SSH is exposed to the entire internet"
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Intentional baseline defect: all outbound traffic is unrestricted"
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
