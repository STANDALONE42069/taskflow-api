#!/bin/sh
set -eu

kube() {
    sh scripts/lab7-kubectl.sh "$@"
}

mkdir -p lab7-evidence
if kube get service taskflow-api >/dev/null 2>&1; then
    kube patch service taskflow-api --type=merge \
        -p "{\"spec\":{\"selector\":{\"app\":\"taskflow-api\",\"color\":\"$LAB7_PREVIOUS_COLOR\"}}}"
    kube get service taskflow-api -o yaml > lab7-evidence/service-after-rollback.yaml
    echo 'AUTOMATIC_ROLLBACK=APPLIED'
    echo "Service selector restored to $LAB7_PREVIOUS_COLOR." >> lab7-evidence/rollback.log
else
    echo 'AUTOMATIC_ROLLBACK=SKIPPED (Service did not exist before the failure)'
fi
