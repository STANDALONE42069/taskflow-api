#!/bin/sh
set -eu

mkdir -p lab7-evidence
active_color="$(sh scripts/lab7-kubectl.sh get service taskflow-api \
    -o jsonpath='{.spec.selector.color}' 2>/dev/null || true)"

if [ "$active_color" = blue ] || [ "$active_color" = green ]; then
    LAB7_PREVIOUS_COLOR="$active_color"
    if [ "$active_color" = blue ]; then LAB7_TARGET_COLOR=green; else LAB7_TARGET_COLOR=blue; fi
    LAB7_BOOTSTRAP=false
else
    LAB7_PREVIOUS_COLOR=blue
    LAB7_TARGET_COLOR=green
    LAB7_BOOTSTRAP=true
fi

commit="${GIT_COMMIT:-$(git rev-parse HEAD)}"
if [ "${LAB7_INJECT_FAILURE:-false}" = true ]; then
    LAB7_DEPLOY_IMAGE="${LAB7_REGISTRY_PULL_ENDPOINT:-localhost:5001}/taskflow-api:missing-$commit"
else
    LAB7_DEPLOY_IMAGE="${LAB7_REGISTRY_PULL_ENDPOINT:-localhost:5001}/taskflow-api:$commit"
fi

export LAB7_PREVIOUS_COLOR LAB7_TARGET_COLOR LAB7_BOOTSTRAP LAB7_DEPLOY_IMAGE
printf 'ACTIVE_COLOR=%s TARGET_COLOR=%s BOOTSTRAP=%s DEPLOY_IMAGE=%s\n' \
    "$LAB7_PREVIOUS_COLOR" "$LAB7_TARGET_COLOR" "$LAB7_BOOTSTRAP" "$LAB7_DEPLOY_IMAGE"

if sh scripts/lab7-deploy.sh; then
    exit 0
else
    deploy_status=$?
fi
if [ "$LAB7_PREVIOUS_COLOR" = blue ] || [ "$LAB7_PREVIOUS_COLOR" = green ]; then
    sh scripts/lab7-rollback.sh || true
fi
exit "$deploy_status"
