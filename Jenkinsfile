pipeline {
    agent { label 'linux-build' }

    parameters {
        booleanParam(
            name: 'LAB7_INJECT_FAILURE',
            defaultValue: false,
            description: 'Use a missing image tag to demonstrate automatic blue/green rollback.'
        )
        booleanParam(
            name: 'LAB9_RUN_K8S_BURST',
            defaultValue: false,
            description: 'Run ten 6-minute Kubernetes agent requests for the Lab 9 queue-alert demonstration.'
        )
    }

    environment {
        APP_NAME = 'taskflow-api'
        NODE_ENV = 'test'
        CI = 'true'
        NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm-cache"
        // Bound each registry request so a stalled download can retry within the pipeline timeout.
        NPM_CONFIG_FETCH_TIMEOUT = '30000'
        NPM_CONFIG_FETCH_RETRY_MINTIMEOUT = '1000'
        NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT = '5000'
    }

    options {
        // A hung install or test must not occupy an executor forever; cap the whole run.
        timeout(time: 90, unit: 'MINUTES')
        disableConcurrentBuilds(abortPrevious: false)
    }

    stages {
        stage('Secrets Detection — Full Git History') {
            steps {
                sh '''
                    set -eu
                    mkdir -p security-reports
                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination \"/home/jenkins/agent\"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        ghcr.io/gitleaks/gitleaks:v8.30.1 \\
                        git . --redact=100 --report-format json --report-path security-reports/gitleaks.json
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Install') {
            agent {
                kubernetes {
                    cloud 'kubernetes'
                    defaultContainer 'node'
                    yamlFile 'monitoring/kubernetes/node-pod-template.yaml'
                }
            }
            steps {
                echo "LAB9_POD_CI node=${env.NODE_NAME} app=${env.APP_NAME}"
                sh 'node --version'
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm test -- --runInBand'
                }
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Prepare Docker-dependent checks') {
            steps {
                sh '''
                    set -eu
                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "/home/jenkins/agent"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE/backend" node:24-alpine3.24 npm ci
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('SAST — ESLint and Semgrep') {
            steps {
                sh '''
                    set -eu
                    mkdir -p security-reports
                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination \"/home/jenkins/agent\"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        semgrep/semgrep:1.178.0 \\
                        semgrep scan --config=p/owasp-top-ten --config=p/nodejs --metrics=off \\
                            --sarif --sarif-output=security-reports/semgrep.sarif backend/src > /dev/null
                    cd backend
                    npx eslint --plugin security --format @microsoft/eslint-formatter-sarif \\
                        src/ > ../security-reports/eslint-security.sarif
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('SCA — npm audit') {
            steps {
                script {
                    env.AUDIT_PREFIX = env.BRANCH_NAME == 'feature/lab6-cve-demo' ? 'security/critical-demo' : 'backend'
                }
                sh '''
                    set +e
                    npm audit --prefix "$AUDIT_PREFIX" --audit-level=high --json \\
                        > security-reports/npm-audit.json
                    audit_status=$?
                    set -e
                    echo "npm audit exit status: $audit_status (the OPA policy applies the critical-only build gate)"
                    set +e
                    node scripts/check-audit.js security-reports/npm-audit.json \
                        > security-reports/npm-audit-summary.log 2>&1
                    parser_status=$?
                    set -e
                    cat security-reports/npm-audit-summary.log
                    exit "$parser_status"
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Generate and Sign SBOM') {
            steps {
                sh '''
                    set -eu
                    mkdir -p security-reports
                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination \"/home/jenkins/agent\"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        ghcr.io/anchore/syft:v1.52.0 \\
                        dir:backend --source-name taskflow-api --source-version 1.0.0 \\
                            -o cyclonedx-json=security-reports/taskflow-api.cdx.json
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        --user 1000:1000 \\
                        ghcr.io/sigstore/cosign/cosign:v3.1.3 \\
                        signing-config create --no-default-fulcio --no-default-oidc \\
                            --no-default-rekor --no-default-tsa \\
                            --out security-reports/local-signing-config.json
                    trap 'rm -f security-reports/lab6-cosign.key' EXIT
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        --user 1000:1000 \\
                        -e COSIGN_PASSWORD= \\
                        ghcr.io/sigstore/cosign/cosign:v3.1.3 \\
                        generate-key-pair --output-key-prefix security-reports/lab6-cosign
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        --user 1000:1000 \\
                        -e COSIGN_PASSWORD= \\
                        ghcr.io/sigstore/cosign/cosign:v3.1.3 \\
                        sign-blob --signing-config security-reports/local-signing-config.json \\
                            --key security-reports/lab6-cosign.key \\
                            --bundle security-reports/taskflow-api.cdx.json.sigstore.json \\
                            --yes security-reports/taskflow-api.cdx.json
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        --user 1000:1000 \\
                        ghcr.io/sigstore/cosign/cosign:v3.1.3 \\
                        verify-blob --key security-reports/lab6-cosign.pub \\
                            --bundle security-reports/taskflow-api.cdx.json.sigstore.json \\
                            --insecure-ignore-tlog security-reports/taskflow-api.cdx.json
                    rm -f security-reports/lab6-cosign.key
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Policy Gate — OPA critical CVEs') {
            steps {
                sh '''
                    set -eu
                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination \"/home/jenkins/agent\"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    : > security-reports/policy-gate.log
                    decision="$(docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        -w "$WORKSPACE" \\
                        openpolicyagent/opa:1.21.0 \\
                        eval --format raw --input security-reports/npm-audit.json \\
                            --data policy/security.rego data.security.deny)"
                    echo "OPA decision security.deny=$decision" | tee -a security-reports/policy-gate.log
                    if [ "$decision" = true ]; then
                        echo 'POLICY BLOCK: npm audit found one or more critical vulnerabilities.' \\
                            | tee -a security-reports/policy-gate.log
                        exit 1
                    fi
                    if [ "$decision" != false ]; then
                        echo 'Policy returned an invalid decision; failing closed.' \\
                            | tee -a security-reports/policy-gate.log
                        exit 1
                    fi
                    echo 'POLICY PASS: no critical vulnerabilities.' \\
                        | tee -a security-reports/policy-gate.log
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Lint') {
            agent {
                docker {
                    image 'node:24-alpine3.24'
                    reuseNode true
                }
            }
            steps {
                dir('backend') {
                    sh 'npm run lint'
                }
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Unit Test') {
            agent {
                docker {
                    image 'node:24-alpine3.24'
                    reuseNode true
                }
            }
            steps {
                dir('backend') {
                    sh 'JEST_JUNIT_OUTPUT_DIR=reports JEST_JUNIT_OUTPUT_NAME=junit.xml npm test -- --coverage --reporters=default --reporters=jest-junit'
                }
            }
            post {
                always {
                    junit testResults: 'backend/reports/junit.xml', allowEmptyResults: true
                    recordCoverage tools: [[parser: 'COBERTURA', pattern: 'backend/coverage/cobertura-coverage.xml']]
                }
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Lab 9 — Kubernetes Burst Demo') {
            when {
                allOf {
                    branch 'codex/lab9-k8s-metrics'
                    expression { return params.LAB9_RUN_K8S_BURST }
                }
            }
            steps {
                script {
                    def burst = [:]
                    for (int i = 1; i <= 10; i++) {
                        def slot = i
                        burst["k8s-build-${slot}"] = {
                            node('k8s-node') {
                                echo "LAB9_POD_START slot=${slot} node=${env.NODE_NAME}"
                                container('node') {
                                    sh 'node --version'
                                }
                                // Keep the queue saturated long enough for the 5-minute alert.
                                sleep(time: 360, unit: 'SECONDS')
                                echo "LAB9_POD_DONE slot=${slot} node=${env.NODE_NAME}"
                            }
                        }
                    }
                    parallel burst
                }
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        set +x
                        export SONAR_TOKEN="$SONAR_AUTH_TOKEN"
                        workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "/home/jenkins/agent"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                        test -n "$workspace_volume"
                        docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                            -w "$WORKSPACE" \\
                            -e SONAR_HOST_URL \\
                            -e SONAR_TOKEN \\
                            sonarsource/sonar-scanner-cli:5.0.1@sha256:02372948eaeeb10dfbe0cfd4174d44b8e405d0aeae431532b2bdb21d0347bf23 \\
                            -Dsonar.projectKey=taskflow-api \\
                            -Dsonar.projectName="Taskflow API" \\
                            -Dsonar.sources=backend/src \\
                            -Dsonar.tests=backend/tests \\
                            '-Dsonar.test.inclusions=**/*.test.js' \\
                            -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info
                        unset SONAR_TOKEN
                    '''
                }
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('E2E') {
            steps {
                script {
                    env.E2E_PORT = (55000 + env.BUILD_NUMBER.toInteger()).toString()
                }
                sh '''
                    set -eu
                    docker compose -p "taskflow-e2e-${BUILD_NUMBER}" down --remove-orphans || true
                    NODE_ENV=production API_PORT="$E2E_PORT" docker compose -p "taskflow-e2e-${BUILD_NUMBER}" up -d --build api

                    api_container="$(docker compose -p "taskflow-e2e-${BUILD_NUMBER}" ps -q api)"
                    for attempt in $(seq 1 60); do
                        health="$(docker inspect --format='{{.State.Health.Status}}' "$api_container" 2>/dev/null || true)"
                        if [ "$health" = healthy ]; then
                            break
                        fi
                        sleep 2
                    done
                    if [ "$health" != healthy ]; then
                        docker logs "$api_container"
                        exit 1
                    fi

                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "/home/jenkins/agent"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    docker run --rm -v "$workspace_volume:/home/jenkins/agent" \\
                        --user 1000:1000 --add-host=host.docker.internal:host-gateway \\
                        -w "$WORKSPACE/backend" \\
                        -e TASKFLOW_API_URL="http://host.docker.internal:$E2E_PORT" \\
                        mcr.microsoft.com/playwright:v1.63.0-noble \\
                        bash -lc 'test -x node_modules/.bin/playwright && ./node_modules/.bin/playwright test'
                '''
            }
            post {
                always {
                    junit testResults: 'backend/playwright-report/junit.xml', allowEmptyResults: true
                    archiveArtifacts artifacts: 'backend/playwright-report/html/**', allowEmptyArchive: true
                    sh 'docker compose -p "taskflow-e2e-${BUILD_NUMBER}" down --remove-orphans || true'
                }
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Container Image — Build, Push, Trivy') {
            when {
                anyOf {
                    branch 'codex/lab7-green-blue'
                    branch 'codex/lab8-iac'
                }
            }
            steps {
                script {
                    def commit = env.GIT_COMMIT ?: sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.LAB7_COMMIT = commit
                    env.LAB7_IMAGE_REF = "localhost:5001/taskflow-api:${commit}"
                }
                sh '''
                    set -eu
                    mkdir -p security-reports
                    rm -f security-reports/trivy-image.sarif
                    echo "Building immutable image ${LAB7_IMAGE_REF}"
                    docker build --file backend/Dockerfile --tag "$LAB7_IMAGE_REF" backend
                    docker push "$LAB7_IMAGE_REF"

                    workspace_volume="$(docker inspect --format='{{range .Mounts}}{{if eq .Destination \"/home/jenkins/agent\"}}{{.Name}}{{end}}{{end}}' jenkins-linux-build)"
                    test -n "$workspace_volume"
                    set +e
                    docker run --rm \\
                        --volume /var/run/docker.sock:/var/run/docker.sock \\
                        --volume "$workspace_volume:/home/jenkins/agent" \\
                        --volume lab7-trivy-cache:/root/.cache/trivy \\
                        --workdir "$WORKSPACE" \\
                        aquasec/trivy:0.74.0 \\
                        image --format sarif --output security-reports/trivy-image.sarif \\
                            --scanners vuln --exit-code 1 --severity HIGH,CRITICAL "$LAB7_IMAGE_REF"
                    trivy_status=$?
                    set -e
                    test -s security-reports/trivy-image.sarif
                    echo "TRIVY_GATE_EXIT_CODE=$trivy_status (HIGH,CRITICAL block the pipeline)"
                    exit "$trivy_status"
                '''
            }
            post {
                failure {
                    script { env.FAILED_STAGE = env.STAGE_NAME }
                }
            }
        }

        stage('Lab 8 Docker Network') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh network'
            }
        }

        stage('IaC Lint & Validate') {
            when { branch 'codex/lab8-iac' }
            parallel {
                stage('Terraform fmt & validate') {
                    steps {
                        sh 'sh scripts/lab8-pipeline.sh lint-terraform'
                    }
                }
                stage('Ansible lint') {
                    steps {
                        sh 'sh scripts/lab8-pipeline.sh lint-ansible'
                    }
                }
            }
        }

        stage('IaC Security Scan') {
            when { branch 'codex/lab8-iac' }
            parallel {
                stage('tfsec before/after') {
                    steps {
                        sh 'sh scripts/lab8-pipeline.sh scan-tfsec'
                    }
                }
                stage('Checkov before/after') {
                    steps {
                        sh 'sh scripts/lab8-pipeline.sh scan-checkov'
                    }
                }
            }
        }

        stage('LocalEmu Setup — S3 Remote State') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh setup'
            }
        }

        stage('Terraform Plan') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh plan'
            }
        }

        stage('Approval — Terraform Apply') {
            when { branch 'codex/lab8-iac' }
            steps {
                script {
                    def planSummary = readFile('infra/terraform/tfplan-summary.txt').trim()
                    input(
                        id: "lab8-terraform-apply-${env.BUILD_NUMBER}",
                        message: "Review the Terraform plan before applying:\n\n${planSummary}\n\nThis LocalEmu EC2 instance is short-lived and will be destroyed after the Ansible health check.",
                        ok: 'Approve Terraform Apply',
                        submitter: 'jenkins'
                    )
                }
            }
        }

        stage('Terraform Apply') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh apply'
            }
        }

        stage('Configure with Ansible') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh configure-ansible'
            }
        }

        stage('Terraform Destroy — Verify Empty State') {
            when { branch 'codex/lab8-iac' }
            steps {
                sh 'sh scripts/lab8-pipeline.sh destroy'
            }
        }

        stage('Deploy — Blue/Green') {
            when { branch 'codex/lab7-green-blue' }
            steps {
                script {
                    sh 'mkdir -p lab7-evidence && rm -f lab7-evidence/*'
                    def activeColor = sh(
                        script: "sh scripts/lab7-kubectl.sh get service taskflow-api -o jsonpath='{.spec.selector.color}' 2>/dev/null || true",
                        returnStdout: true
                    ).trim()

                    if (activeColor in ['blue', 'green']) {
                        env.LAB7_PREVIOUS_COLOR = activeColor
                        env.LAB7_TARGET_COLOR = activeColor == 'blue' ? 'green' : 'blue'
                        env.LAB7_BOOTSTRAP = 'false'
                    } else {
                        env.LAB7_PREVIOUS_COLOR = 'blue'
                        env.LAB7_TARGET_COLOR = 'green'
                        env.LAB7_BOOTSTRAP = 'true'
                    }

                    echo "DETECTED_ACTIVE_COLOR=${env.LAB7_PREVIOUS_COLOR}"
                    echo "INACTIVE_TARGET_COLOR=${env.LAB7_TARGET_COLOR}"
                    env.LAB7_DEPLOY_IMAGE = params.LAB7_INJECT_FAILURE
                        ? "localhost:5001/taskflow-api:missing-${env.LAB7_COMMIT}"
                        : env.LAB7_IMAGE_REF
                    echo "DEPLOY_IMAGE=${env.LAB7_DEPLOY_IMAGE}"

                    withEnv([
                        "LAB7_BOOTSTRAP=${env.LAB7_BOOTSTRAP}",
                        "LAB7_PREVIOUS_COLOR=${env.LAB7_PREVIOUS_COLOR}",
                        "LAB7_TARGET_COLOR=${env.LAB7_TARGET_COLOR}",
                        "LAB7_DEPLOY_IMAGE=${env.LAB7_DEPLOY_IMAGE}"
                    ]) {
                        sh 'sh scripts/lab7-deploy.sh'
                    }
                }
            }
            post {
                failure {
                    script {
                        if (env.LAB7_PREVIOUS_COLOR in ['blue', 'green']) {
                            withEnv(["LAB7_PREVIOUS_COLOR=${env.LAB7_PREVIOUS_COLOR}"]) {
                                sh 'sh scripts/lab7-rollback.sh'
                            }
                        }
                        env.FAILED_STAGE = env.STAGE_NAME
                    }
                }
            }
        }
        stage('Deploy — Staging') {
            when { branch 'develop' }
            steps {
                sh 'echo deploying to staging--.'
            }
        }

        stage('Deploy — Production') {
            when {
                // Skip the approval prompt as well as deployment on feature/PR/develop.
                beforeInput true
                branch 'main'
            }
            input {
                message 'Deploy to production?'
                ok 'Approve production'
                submitter 'jenkins'
            }
            steps {
                sh 'echo deploying to production--.'
            }
        }
    }

    post {
        success {
            echo "✅ ${env.APP_NAME} passed on ${env.NODE_ENV}"
        }
        failure {
            // Capture env.STAGE_NAME inside the failed stage before entering pipeline post.
            echo "❌ Failed at stage: ${env.FAILED_STAGE ?: env.STAGE_NAME}"
        }
        always {
            script {
                if (env.BRANCH_NAME == 'codex/lab8-iac') {
                    sh 'sh scripts/lab8-pipeline.sh destroy'
                    sh 'rm -f infra/ansible/.lab8_key infra/ansible/.lab8_key.pub infra/ansible/inventory.ini'
                }
            }
            archiveArtifacts artifacts: 'security-reports/**', allowEmptyArchive: true, fingerprint: true
            archiveArtifacts artifacts: 'lab7-evidence/**', allowEmptyArchive: true, fingerprint: true
            archiveArtifacts artifacts: 'infra/terraform/tfplan,infra/terraform/tfplan.txt,infra/terraform/tfplan-summary.txt,lab8-evidence/**', allowEmptyArchive: true, fingerprint: true
            archiveArtifacts artifacts: '**/npm-debug.log*', allowEmptyArchive: true
        }
    }
}
