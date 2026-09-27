#!/bin/sh
set -eu

TOOLS_DIR="${WORKSPACE:-$(pwd)}/.tools/bin"
mkdir -p "$TOOLS_DIR"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT HUP INT TERM

download() {
    curl --fail --location --retry 3 --silent --show-error "$2" --output "$1"
}

extract_binary() {
    archive="$1"
    member="$2"
    binary="$3"
    tar -xzf "$archive" -C "$scratch" "$member"
    install -m 0755 "$scratch/$member" "$TOOLS_DIR/$binary"
}

if [ ! -x "$TOOLS_DIR/gitleaks" ]; then
    download "$scratch/gitleaks.tgz" https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
    extract_binary "$scratch/gitleaks.tgz" gitleaks gitleaks
fi

if [ ! -x "$TOOLS_DIR/syft" ]; then
    download "$scratch/syft.tgz" https://github.com/anchore/syft/releases/download/v1.52.0/syft_1.52.0_linux_amd64.tar.gz
    extract_binary "$scratch/syft.tgz" syft syft
fi

if [ ! -x "$TOOLS_DIR/cosign" ]; then
    download "$TOOLS_DIR/cosign" https://github.com/sigstore/cosign/releases/download/v3.1.3/cosign-linux-amd64
    chmod 0755 "$TOOLS_DIR/cosign"
fi

if [ ! -x "$TOOLS_DIR/opa" ]; then
    download "$TOOLS_DIR/opa" https://openpolicyagent.org/downloads/v1.21.0/opa_linux_amd64_static
    chmod 0755 "$TOOLS_DIR/opa"
fi

if [ ! -x "$TOOLS_DIR/trivy" ]; then
    download "$scratch/trivy.tgz" https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz
    extract_binary "$scratch/trivy.tgz" trivy trivy
fi

if [ ! -x "$TOOLS_DIR/terraform" ]; then
    download "$scratch/terraform.zip" https://releases.hashicorp.com/terraform/1.12.2/terraform_1.12.2_linux_amd64.zip
    unzip -q "$scratch/terraform.zip" terraform -d "$scratch"
    install -m 0755 "$scratch/terraform" "$TOOLS_DIR/terraform"
fi

if [ ! -x "$TOOLS_DIR/tfsec" ]; then
    download "$TOOLS_DIR/tfsec" https://github.com/aquasecurity/tfsec/releases/download/v1.28.14/tfsec-linux-amd64
    chmod 0755 "$TOOLS_DIR/tfsec"
fi

if [ ! -x "$TOOLS_DIR/kubectl" ]; then
    download "$TOOLS_DIR/kubectl" https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubectl
    chmod 0755 "$TOOLS_DIR/kubectl"
fi

printf 'Lab 10 tools ready in %s\n' "$TOOLS_DIR"
