data "aws_vpc" "default" {
  default = true
}

resource "aws_internet_gateway" "taskflow" {
  vpc_id = data.aws_vpc.default.id

  tags = {
    Name    = "taskflow-lab8-${var.build_id}"
    Project = "taskflow-api"
    Lab     = "8"
  }
}

resource "aws_route" "taskflow_internet" {
  route_table_id         = data.aws_vpc.default.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.taskflow.id
}

resource "aws_security_group" "taskflow" {
  name        = "taskflow-lab8-${var.build_id}"
  description = "TaskFlow Lab 8 access restricted to the VPC"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from the private lab network"
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  ingress {
    description = "TaskFlow API from the private lab network"
    protocol    = "tcp"
    from_port   = 8080
    to_port     = 8080
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  egress {
    description = "HTTP package repositories"
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    #tfsec:ignore:aws-ec2-no-public-egress-sgr:exp:2027-09-27 # Short-lived lab host needs Ubuntu mirrors; only TCP/80 is allowed.
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTPS package repositories and container registry"
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    #tfsec:ignore:aws-ec2-no-public-egress-sgr:exp:2027-09-27 # Short-lived lab host needs the image registry; only TCP/443 is allowed.
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS lookups"
    protocol    = "udp"
    from_port   = 53
    to_port     = 53
    #tfsec:ignore:aws-ec2-no-public-egress-sgr:exp:2027-09-27 # DNS is required to resolve Ubuntu mirrors and the image registry.
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "taskflow" {
  name = "taskflow-lab8-${var.build_id}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  description = "No-permission instance identity for the short-lived TaskFlow Lab 8 host"
  tags = {
    Project = "taskflow-api"
    Lab     = "8"
  }
}

resource "aws_iam_instance_profile" "taskflow" {
  name = "taskflow-lab8-${var.build_id}"
  role = aws_iam_role.taskflow.name
  tags = {
    Project = "taskflow-api"
    Lab     = "8"
  }
}

resource "aws_key_pair" "taskflow" {
  key_name   = "taskflow-lab8-${var.build_id}"
  public_key = file(var.public_key_path)

  tags = {
    Project = "taskflow-api"
    Lab     = "8"
  }
}

resource "aws_instance" "taskflow" {
  ami                    = var.ami_id
  instance_type          = "t3.small"
  ebs_optimized          = true
  key_name               = aws_key_pair.taskflow.key_name
  iam_instance_profile   = aws_iam_instance_profile.taskflow.name
  monitoring             = true
  vpc_security_group_ids = [aws_security_group.taskflow.id]

  depends_on = [aws_route.taskflow_internet]

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted   = true
    volume_size = 8
    volume_type = "gp3"
  }

  tags = {
    Name    = "taskflow-lab8-${var.build_id}"
    Project = "taskflow-api"
    Lab     = "8"
  }
}
