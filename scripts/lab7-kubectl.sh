#!/bin/sh
set -eu

if [ -n "${KUBECTL:-}" ]; then
    kubectl_bin="$KUBECTL"
elif command -v kubectl >/dev/null 2>&1; then
    kubectl_bin="$(command -v kubectl)"
elif [ -x "${WORKSPACE:-$(pwd)}/.tools/bin/kubectl" ]; then
    kubectl_bin="${WORKSPACE:-$(pwd)}/.tools/bin/kubectl"
else
    echo 'kubectl is not installed; run scripts/install-kubectl.sh first.' >&2
    exit 127
fi

exec "$kubectl_bin" --namespace="${TASKFLOW_K8S_NAMESPACE:-default}" "$@"
