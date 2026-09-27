#!/bin/sh
set -eu
exec docker exec -i lab7-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf "$@"
