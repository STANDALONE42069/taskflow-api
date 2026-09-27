#!/bin/sh
set -eu

kube() {
    sh scripts/lab7-kubectl.sh "$@"
}

mkdir -p lab7-evidence

api_ready=false
for attempt in $(seq 1 60); do
    if kube get --raw=/readyz >/dev/null 2>&1; then
        api_ready=true
        break
    fi
    sleep 2
done
if [ "$api_ready" != true ]; then
    echo 'Kubernetes API did not become ready within 120 seconds.'
    exit 1
fi
echo 'Kubernetes API is ready.'

if [ "$LAB7_BOOTSTRAP" = true ]; then
    sed "s|__TASKFLOW_IMAGE__|$LAB7_IMAGE_REF|g" k8s/lab7/deployment-template.yaml \
        | kube apply -f -
    kube apply -f - < k8s/lab7/service.yaml
    kube rollout status deployment/taskflow-blue --timeout=120s
    kube rollout status deployment/taskflow-green --timeout=120s
    echo 'No existing Service found; initialized blue as the active color.'
fi

kube get service taskflow-api -o yaml > lab7-evidence/service-before.yaml
kube set image "deployment/taskflow-$LAB7_TARGET_COLOR" "taskflow-api=$LAB7_DEPLOY_IMAGE"
kube rollout status "deployment/taskflow-$LAB7_TARGET_COLOR" --timeout=90s

# Smoke-test every target Pod IP directly, before changing the Service selector.
index=0
pods=$(kube get pods -l "app=taskflow-api,color=$LAB7_TARGET_COLOR" \
    -o jsonpath='{.items[*].metadata.name}')
test -n "$pods"
for pod in $pods; do
    pod_ip=$(kube get pod "$pod" -o jsonpath='{.status.podIP}')
    smoke_pod="lab7-smoke-$BUILD_NUMBER-$index"
    echo "Direct smoke test: pod=$pod ip=$pod_ip"
    kube run "$smoke_pod" --image=curlimages/curl:8.13.0 --restart=Never \
        --image-pull-policy=IfNotPresent --command -- curl --fail --silent --show-error \
        --max-time 15 "http://$pod_ip:5000/health"
    set +e
    kube wait --for=jsonpath='{.status.phase}'=Succeeded "pod/$smoke_pod" --timeout=120s
    smoke_status=$?
    set -e
    kube logs "$smoke_pod" || true
    kube delete pod "$smoke_pod" --ignore-not-found=true
    if [ "$smoke_status" -ne 0 ]; then
        exit "$smoke_status"
    fi
    index=$((index + 1))
done

kube patch service taskflow-api --type=merge \
    -p "{\"spec\":{\"selector\":{\"app\":\"taskflow-api\",\"color\":\"$LAB7_TARGET_COLOR\"}}}"
kube get service taskflow-api -o yaml > lab7-evidence/service-after-success.yaml
echo 'BLUE_GREEN_SWITCH=SUCCESS'
