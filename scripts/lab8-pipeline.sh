#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

TERRAFORM_IMAGE="${TERRAFORM_IMAGE:-hashicorp/terraform:1.12.2}"
TFSEC_IMAGE="${TFSEC_IMAGE:-ghcr.io/aquasecurity/tfsec:v1.28.14}"
CHECKOV_IMAGE="${CHECKOV_IMAGE:-bridgecrew/checkov:latest}"
ANSIBLE_IMAGE="${ANSIBLE_IMAGE:-ghcr.io/ansible/community-ansible-dev-tools:latest}"
LOCALEMU_IMAGE="${LOCALEMU_IMAGE:-localemu/localemu:1.2.0}"
LOCALEMU_NAME="${LOCALEMU_NAME:-lab8-localemu}"
DOCKER_NETWORK="${DOCKER_NETWORK:-lab8-network}"
STATE_BUCKET="taskflow-lab8-state"
REGION="us-east-1"
WORKSPACE="${WORKSPACE:-$ROOT_DIR}"

WORKSPACE_VOLUME="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "/home/jenkins/agent"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
if [ -z "$WORKSPACE_VOLUME" ]; then
    echo "Could not find the Jenkins agent workspace volume." >&2
    exit 2
fi

ensure_lab_network() {
    if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
        docker network create "$DOCKER_NETWORK" >/dev/null
    fi
    docker network connect "$DOCKER_NETWORK" jenkins-linux-build >/dev/null 2>&1 || true
}

remove_instance_runtime() {
    instance_id="$1"
    [ -n "$instance_id" ] || return 0
    instance_container="localemu-ec2-$instance_id"
    instance_network="${2:-}"
    if [ -z "$instance_network" ] && docker inspect "$instance_container" >/dev/null 2>&1; then
        instance_network="$(docker inspect --format='{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' \
            "$instance_container" | sed -n '/^localemu-vpc/p' | head -n 1)"
    fi
    docker rm -f "taskflow-api-lab8-$instance_id" "$instance_container" >/dev/null 2>&1 || true
    if [ -n "$instance_network" ]; then
        docker network rm "$instance_network" >/dev/null 2>&1 || true
    fi
}

terraform() {
    ensure_lab_network
    docker run --rm \
        --network "$DOCKER_NETWORK" \
        --volume "$WORKSPACE_VOLUME:/home/jenkins/agent" \
        --volume lab8-terraform-plugin-cache:/root/.terraform.d/plugin-cache \
        --workdir "$WORKSPACE" \
        --env TF_INPUT=0 \
        --env TF_IN_AUTOMATION=1 \
        --env TF_PLUGIN_CACHE_DIR=/root/.terraform.d/plugin-cache \
        --env AWS_ACCESS_KEY_ID=test \
        --env AWS_SECRET_ACCESS_KEY=test \
        --env AWS_REGION="$REGION" \
        --env AWS_DEFAULT_REGION="$REGION" \
        --env AWS_EC2_METADATA_DISABLED=true \
        --env AWS_ENDPOINT_URL_S3="http://$LOCALEMU_NAME:4566" \
        "$TERRAFORM_IMAGE" "$@"
}

security_scanner() {
    scanner_image="$1"
    shift
    ensure_lab_network
    docker run --rm \
        --network "$DOCKER_NETWORK" \
        --volume "$WORKSPACE_VOLUME:/home/jenkins/agent" \
        --workdir "$WORKSPACE" \
        "$scanner_image" "$@"
}

ensure_key() {
    key_path="infra/ansible/.lab8_key"
    if [ ! -s "$key_path" ]; then
        ssh-keygen -q -t ed25519 -N '' -C "jenkins-lab8-${BUILD_NUMBER:-local}" -f "$key_path"
    fi
    chmod 600 "$key_path"
    chmod 644 "$key_path.pub"
}

setup_localemu() {
    ensure_lab_network
    rm -f infra/terraform/.lab8-backend-ready

    # Remove only the prior Lab 8 EC2 box recorded in this workspace.
    if [ -s infra/ansible/.lab8_instance_id ]; then
        stale_id="$(cat infra/ansible/.lab8_instance_id)"
        remove_instance_runtime "$stale_id"
    fi
    docker rm -f "$LOCALEMU_NAME" >/dev/null 2>&1 || true
    docker pull "$LOCALEMU_IMAGE" >/dev/null
    docker run --detach \
        --name "$LOCALEMU_NAME" \
        --network "$DOCKER_NETWORK" \
        --network-alias "$LOCALEMU_NAME" \
        --publish 4566:4566 \
        --user root \
        --volume /var/run/docker.sock:/var/run/docker.sock \
        --env EC2_VM_MANAGER=docker \
        "$LOCALEMU_IMAGE" >/dev/null

    ready=0
    attempt=0
    while [ "$attempt" -lt 90 ]; do
        if curl --silent --fail "http://$LOCALEMU_NAME:4566/_localemu/health" >/dev/null 2>&1; then
            ready=1
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    if [ "$ready" -ne 1 ]; then
        docker logs "$LOCALEMU_NAME" || true
        echo "LocalEmu did not become healthy within 180 seconds." >&2
        exit 1
    fi

    docker exec "$LOCALEMU_NAME" sh -c \
        ". /opt/code/localemu/.venv/bin/activate && awsemu s3api create-bucket --bucket $STATE_BUCKET" \
        >/dev/null 2>&1 || docker exec "$LOCALEMU_NAME" sh -c \
        ". /opt/code/localemu/.venv/bin/activate && awsemu s3api head-bucket --bucket $STATE_BUCKET" >/dev/null

    ensure_key
    terraform -chdir=infra/terraform init -input=false -reconfigure
    touch infra/terraform/.lab8-backend-ready
}

lint_terraform() {
    terraform -chdir=infra/terraform fmt -check -recursive -diff
    terraform -chdir=infra/terraform init -backend=false -input=false
    terraform -chdir=infra/terraform validate
}

lint_ansible() {
    ensure_lab_network
    docker run --rm \
        --network "$DOCKER_NETWORK" \
        --volume "$WORKSPACE_VOLUME:/home/jenkins/agent" \
        --workdir "$WORKSPACE/infra/ansible" \
        "$ANSIBLE_IMAGE" ansible-lint playbook.yml
}

scan_tfsec() {
    mkdir -p security-reports
    set +e
    security_scanner "$TFSEC_IMAGE" infra/security-baseline --no-color --format lovely \
        >security-reports/tfsec-before.txt 2>&1
    before_status=$?
    set -e
    if [ "$before_status" -eq 0 ] || ! grep -Eiq '0\.0\.0\.0/0|public|critical|high|medium' security-reports/tfsec-before.txt; then
        echo "tfsec did not report the intentionally vulnerable baseline." >&2
        cat security-reports/tfsec-before.txt
        exit 1
    fi
    printf '\nBaseline scan exit code: %s (expected non-zero because of the intentionally public SSH rule).\n' "$before_status" \
        >>security-reports/tfsec-before.txt

    security_scanner "$TFSEC_IMAGE" infra/terraform --no-color --format lovely \
        >security-reports/tfsec-after.txt 2>&1
    cat security-reports/tfsec-after.txt
}

scan_checkov() {
    mkdir -p security-reports
    set +e
    security_scanner "$CHECKOV_IMAGE" -d infra/security-baseline --framework terraform \
        >security-reports/checkov-before.txt 2>&1
    before_status=$?
    set -e
    if [ "$before_status" -eq 0 ] || ! grep -Eiq 'CKV_AWS_|FAILED|failed' security-reports/checkov-before.txt; then
        echo "Checkov did not report the intentionally vulnerable baseline." >&2
        cat security-reports/checkov-before.txt
        exit 1
    fi
    printf '\nBaseline scan exit code: %s (expected non-zero because of the intentionally public SSH rule).\n' "$before_status" \
        >>security-reports/checkov-before.txt

    security_scanner "$CHECKOV_IMAGE" -d infra/terraform --framework terraform \
        >security-reports/checkov-after.txt 2>&1
    cat security-reports/checkov-after.txt
    security_scanner "$CHECKOV_IMAGE" -d infra/terraform --framework terraform \
        --output json >security-reports/checkov-after.json
}

terraform_plan() {
    if [ -z "${LAB7_IMAGE_REF:-}" ]; then
        echo "LAB7_IMAGE_REF is empty; the Lab 7 image stage must run first." >&2
        exit 2
    fi
    terraform -chdir=infra/terraform plan -input=false \
        -var "build_id=${BUILD_NUMBER:-local}" \
        -var "image_ref=$LAB7_IMAGE_REF" \
        -out=tfplan
    terraform -chdir=infra/terraform show -no-color tfplan >infra/terraform/tfplan.txt
    grep -E '^Plan:' infra/terraform/tfplan.txt >infra/terraform/tfplan-summary.txt
    mkdir -p lab8-evidence
    cp infra/terraform/tfplan-summary.txt lab8-evidence/terraform-plan-summary.txt
    cat infra/terraform/tfplan-summary.txt
}

terraform_apply() {
    terraform -chdir=infra/terraform apply -input=false tfplan
    address="$(terraform -chdir=infra/terraform output -raw instance_address)"
    instance_id="$(terraform -chdir=infra/terraform output -raw instance_id)"
    printf '%s\n' "$instance_id" >infra/ansible/.lab8_instance_id
    printf 'APPLIED_INSTANCE_ID=%s\nAPPLIED_INSTANCE_ADDRESS=%s\n' "$instance_id" "$address" \
        | tee lab8-evidence/applied-instance.txt
}

configure_ansible() {
    address="$(terraform -chdir=infra/terraform output -raw instance_address)"
    instance_id="$(terraform -chdir=infra/terraform output -raw instance_id)"
    instance_container="localemu-ec2-$instance_id"
    instance_network="$(docker inspect --format='{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' \
        "$instance_container" | sed -n '/^localemu-vpc/p' | head -n 1)"
    if [ -z "$instance_network" ]; then
        echo "Could not locate the Docker VPC network for $instance_container." >&2
        exit 1
    fi

    printf '[taskflow]\n%s ansible_user=ubuntu ansible_ssh_private_key_file=%s ansible_python_interpreter=/usr/bin/python3 instance_id=%s\n' \
        "$address" "$WORKSPACE/infra/ansible/.lab8_key" "$instance_id" >infra/ansible/inventory.ini
    chmod 600 infra/ansible/inventory.ini

    runner_name="lab8-ansible-${BUILD_NUMBER:-local}"
    cleanup_ansible_runner() {
        docker rm -f "$runner_name" >/dev/null 2>&1 || true
    }
    trap cleanup_ansible_runner 0 1 2 15
    docker run --detach \
        --name "$runner_name" \
        --network "$instance_network" \
        --volume "$WORKSPACE_VOLUME:/home/jenkins/agent" \
        --workdir "$WORKSPACE/infra/ansible" \
        --env "ANSIBLE_CONFIG=$WORKSPACE/infra/ansible/ansible.cfg" \
        --env ANSIBLE_HOST_KEY_CHECKING=False \
        --env "LAB7_IMAGE_REF=$LAB7_IMAGE_REF" \
        --entrypoint /bin/sh \
        "$ANSIBLE_IMAGE" -c 'while :; do sleep 3600; done' >/dev/null
    docker exec "$runner_name" ansible-playbook playbook.yml \
        --inventory inventory.ini \
        --extra-vars "taskflow_image=$LAB7_IMAGE_REF"

    printf 'APPLICATION_HEALTHY=http://%s:8080/health (verified by Ansible inside the instance)\n' "$address" \
        | tee lab8-evidence/application-health.txt
}

terraform_destroy() {
    mkdir -p security-reports lab8-evidence
    if [ ! -f infra/terraform/.lab8-backend-ready ]; then
        docker rm -f "$LOCALEMU_NAME" >/dev/null 2>&1 || true
        echo "Terraform remote state was not initialized; no managed resources exist." \
            | tee security-reports/state-after-destroy.txt
        return 0
    fi

    if instance_id="$(terraform -chdir=infra/terraform output -raw instance_id 2>/dev/null)"; then
        :
    elif [ -s infra/ansible/.lab8_instance_id ]; then
        instance_id="$(cat infra/ansible/.lab8_instance_id)"
        docker rm -f "taskflow-api-lab8-$instance_id" >/dev/null 2>&1 || true
    else
        instance_id=""
    fi
    instance_network=""
    if [ -n "$instance_id" ] && docker inspect "localemu-ec2-$instance_id" >/dev/null 2>&1; then
        instance_network="$(docker inspect --format='{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' \
            "localemu-ec2-$instance_id" | sed -n '/^localemu-vpc/p' | head -n 1)"
    fi

    terraform -chdir=infra/terraform destroy -input=false -auto-approve \
        -var "build_id=${BUILD_NUMBER:-local}" \
        -var "image_ref=${LAB7_IMAGE_REF:-not-built}"

    remove_instance_runtime "$instance_id" "$instance_network"

    terraform -chdir=infra/terraform state list >security-reports/state-after-destroy.txt
    if [ -s security-reports/state-after-destroy.txt ]; then
        echo "Terraform state still contains managed resources:" >&2
        cat security-reports/state-after-destroy.txt >&2
        exit 1
    fi
    printf 'managed_resources=0\nTerraform state list is empty.\n' \
        | tee security-reports/state-after-destroy.txt
    rm -f infra/ansible/.lab8_instance_id
}

case "${1:-}" in
    network) ensure_lab_network ;;
    setup) setup_localemu ;;
    lint-terraform) lint_terraform ;;
    lint-ansible) lint_ansible ;;
    scan-tfsec) scan_tfsec ;;
    scan-checkov) scan_checkov ;;
    plan) terraform_plan ;;
    apply) terraform_apply ;;
    configure-ansible) configure_ansible ;;
    destroy) terraform_destroy ;;
    *)
        echo "Usage: $0 {network|setup|lint-terraform|lint-ansible|scan-tfsec|scan-checkov|plan|apply|configure-ansible|destroy}" >&2
        exit 2
        ;;
esac
