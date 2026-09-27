#!/bin/sh
set -eu

TOOLS_DIR="${WORKSPACE:-$(pwd)}/.tools/bin"
mkdir -p "$TOOLS_DIR"
if [ ! -x "$TOOLS_DIR/kubectl" ]; then
    curl --fail --location --retry 3 --silent --show-error \
        https://dl.k8s.io/release/v1.37.0/bin/linux/amd64/kubectl \
        --output "$TOOLS_DIR/kubectl.tmp"
    chmod 0755 "$TOOLS_DIR/kubectl.tmp"
    mv "$TOOLS_DIR/kubectl.tmp" "$TOOLS_DIR/kubectl"
fi
