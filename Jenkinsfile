pipeline {
    agent none

    parameters {
        booleanParam(
            name: 'LAB7_INJECT_FAILURE',
            defaultValue: false,
            description: 'Use a missing image tag to demonstrate the blue/green rollback.'
        )
        booleanParam(
            name: 'LAB9_RUN_K8S_BURST',
            defaultValue: false,
            description: 'Request ten dynamic Kubernetes agents for the Lab 9 queue-alert demonstration.'
        )
    }

    environment {
        NODE_ENV = 'test'
        CI = 'true'
        LAB7_REGISTRY_PUSH_ENDPOINT = 'lab7-registry:5000'
        LAB9_PROMETHEUS_URL = 'http://lab9-prometheus:9090'
    }

    options {
        timeout(time: 120, unit: 'MINUTES')
        disableConcurrentBuilds(abortPrevious: false)
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }

    stages {
        stage('API — Continuous Integration') {
            agent {
                kubernetes {
                    cloud 'kubernetes'
                    defaultContainer 'node'
                    yamlFile 'monitoring/kubernetes/lab10-api-agent.yaml'
                    retries 2
                }
            }

            stages {
                stage('Install CI Utilities') {
                    steps {
                        container('tools') {
                            sh 'sh scripts/install-lab10-tools.sh'
                        }
                    }
                }

                stage('Secrets Detection — Full Git History') {
                    steps {
                        container('tools') {
                            sh '''
                                mkdir -p security-reports
                                .tools/bin/gitleaks git . --redact=100 \\
                                    --report-format json --report-path security-reports/gitleaks.json
                            '''
                        }
                    }
                }

                stage('Install API Dependencies') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }

                stage('Parallel Quality Gates') {
                    parallel {
                        stage('Lint') {
                            steps {
                                dir('backend') {
                                    sh 'npm run lint'
                                }
                            }
                        }

                        stage('Unit Test') {
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
                            }
                        }

                        stage('SAST — Semgrep and ESLint Security') {
                            steps {
                                container('python') {
                                    sh '''
                                        python -m pip install --user --disable-pip-version-check --no-cache-dir semgrep==1.178.0
                                        mkdir -p security-reports
                                        semgrep scan --config=p/owasp-top-ten --config=p/nodejs --metrics=off \\
                                            --sarif --sarif-output=security-reports/semgrep.sarif backend/src
                                    '''
                                }
                                dir('backend') {
                                    sh 'npx eslint --plugin security --format @microsoft/eslint-formatter-sarif src/ > ../security-reports/eslint-security.sarif'
                                }
                            }
                        }

                        stage('SCA — npm audit') {
                            steps {
                                sh '''
                                    mkdir -p security-reports
                                    set +e
                                    npm audit --prefix backend --audit-level=high --json \\
                                        > security-reports/npm-audit.json
                                    audit_status=$?
                                    set -e
                                    echo "npm audit exit status: $audit_status (OPA applies the critical-only build gate)"
                                    node scripts/check-audit.js security-reports/npm-audit.json \\
                                        > security-reports/npm-audit-summary.log 2>&1
                                    cat security-reports/npm-audit-summary.log
                                    test -s security-reports/npm-audit.json
                                '''
                            }
                        }
                    }
                }

                stage('Policy Gate — OPA critical CVEs') {
                    steps {
                        container('tools') {
                            sh '''
                                decision="$(.tools/bin/opa eval --format raw \\
                                    --input security-reports/npm-audit.json \\
                                    --data policy/security.rego data.security.deny)"
                                echo "OPA decision security.deny=$decision" | tee security-reports/policy-gate.log
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
                    }
                }

                stage('Generate and Sign SBOM') {
                    steps {
                        container('tools') {
                            sh '''
                                set -eu
                                mkdir -p security-reports
                                .tools/bin/syft dir:backend --source-name taskflow-api \\
                                    --source-version "$GIT_COMMIT" \\
                                    -o cyclonedx-json=security-reports/taskflow-api.cdx.json
                                .tools/bin/cosign signing-config create --no-default-fulcio \\
                                    --no-default-oidc --no-default-rekor --no-default-tsa \\
                                    --out security-reports/local-signing-config.json
                                trap 'rm -f security-reports/lab10-cosign.key' EXIT
                                COSIGN_PASSWORD= .tools/bin/cosign generate-key-pair \\
                                    --output-key-prefix security-reports/lab10-cosign
                                COSIGN_PASSWORD= .tools/bin/cosign sign-blob \\
                                    --signing-config security-reports/local-signing-config.json \\
                                    --key security-reports/lab10-cosign.key \\
                                    --bundle security-reports/taskflow-api.cdx.json.sigstore.json \\
                                    --yes security-reports/taskflow-api.cdx.json
                                .tools/bin/cosign verify-blob \\
                                    --key security-reports/lab10-cosign.pub \\
                                    --bundle security-reports/taskflow-api.cdx.json.sigstore.json \\
                                    --insecure-ignore-tlog security-reports/taskflow-api.cdx.json
                            '''
                        }
                    }
                }

                stage('SonarQube Analysis') {
                    steps {
                        withSonarQubeEnv('SonarQube') {
                            container('sonar') {
                                sh '''
                                    set +x
                                    export SONAR_TOKEN="$SONAR_AUTH_TOKEN"
                                    sonar-scanner \\
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
                    }
                }

                stage('Quality Gate') {
                    steps {
                        timeout(time: 5, unit: 'MINUTES') {
                            waitForQualityGate abortPipeline: true
                        }
                    }
                }

                stage('E2E — Playwright') {
                    steps {
                        container('playwright') {
                            sh '''
                                set -eu
                                cd backend
                                npm ci
                                NODE_ENV=production PORT=55000 node src/index.js > ../security-reports/e2e-api.log 2>&1 &
                                api_pid=$!
                                trap 'kill "$api_pid" 2>/dev/null || true' EXIT
                                ready=0
                                for attempt in $(seq 1 60); do
                                    if node -e 'fetch("http://127.0.0.1:55000/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'; then
                                        ready=1
                                        break
                                    fi
                                    sleep 2
                                done
                                if [ "$ready" -ne 1 ]; then
                                    cat ../security-reports/e2e-api.log
                                    exit 1
                                fi
                                TASKFLOW_API_URL=http://127.0.0.1:55000 ./node_modules/.bin/playwright test
                            '''
                        }
                    }
                    post {
                        always {
                            junit testResults: 'backend/playwright-report/junit.xml', allowEmptyResults: true
                            archiveArtifacts artifacts: 'backend/playwright-report/html/**', allowEmptyArchive: true
                        }
                    }
                }

                stage('Container Image — Kaniko, Push and Trivy') {
                    steps {
                        script {
                            env.LAB7_COMMIT = env.GIT_COMMIT ?: sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                            env.LAB7_IMAGE_REF = env.LAB7_REGISTRY_PUSH_ENDPOINT + "/taskflow-api:" + env.LAB7_COMMIT
                            env.LAB7_PUSH_IMAGE_REF = env.LAB7_REGISTRY_PUSH_ENDPOINT + "/taskflow-api:" + env.LAB7_COMMIT
                        }
                        container('kaniko') {
                            sh '''
                                /kaniko/executor \\
                                    --context "$WORKSPACE/backend" \\
                                    --dockerfile "$WORKSPACE/backend/Dockerfile" \\
                                    --destination "$LAB7_PUSH_IMAGE_REF" \\
                                    --insecure-registry lab7-registry:5000 \\
                                    --snapshot-mode redo
                            '''
                        }
                        container('tools') {
                            sh '''
                                set +e
                                .tools/bin/trivy image --insecure --format sarif \\
                                    --output security-reports/trivy-image.sarif \\
                                    --scanners vuln --exit-code 1 --severity HIGH,CRITICAL \\
                                    "$LAB7_PUSH_IMAGE_REF"
                                trivy_status=$?
                                set -e
                                test -s security-reports/trivy-image.sarif
                                echo "TRIVY_GATE_EXIT_CODE=$trivy_status (HIGH,CRITICAL block the pipeline)"
                                exit "$trivy_status"
                            '''
                        }
                    }
                }

                stage('Lab 8 — IaC Lint and Security Gates') {
                    stages {
                        stage('Install IaC Toolchain') {
                            steps {
                                container('python') {
                                    sh 'python -m pip install --user --disable-pip-version-check --no-cache-dir checkov ansible-lint'
                                }
                            }
                        }

                        stage('IaC Quality Gates') {
                            parallel {
                                stage('Terraform fmt and validate') {
                                    steps {
                                        container('tools') {
                                            sh '''
                                        .tools/bin/terraform -chdir=infra/terraform fmt -check -recursive -diff
                                        .tools/bin/terraform -chdir=infra/terraform init -backend=false -input=false
                                        .tools/bin/terraform -chdir=infra/terraform validate
                                    '''
                                        }
                                    }
                                }

                                stage('tfsec before and after') {
                                    steps {
                                        container('tools') {
                                            sh '''
                                        mkdir -p security-reports
                                        set +e
                                        .tools/bin/tfsec infra/security-baseline --no-color --format lovely \\
                                            >security-reports/tfsec-before.txt 2>&1
                                        before_status=$?
                                        set -e
                                        if [ "$before_status" -eq 0 ] || ! grep -Eiq '0\\.0\\.0\\.0/0|public|critical|high|medium' security-reports/tfsec-before.txt; then
                                            cat security-reports/tfsec-before.txt
                                            echo 'tfsec did not flag the intentionally vulnerable baseline.' >&2
                                            exit 1
                                        fi
                                        .tools/bin/tfsec infra/terraform --no-color --format lovely \\
                                            >security-reports/tfsec-after.txt
                                        cat security-reports/tfsec-after.txt
                                    '''
                                        }
                                    }
                                }

                                stage('Checkov before and after') {
                                    steps {
                                        container('python') {
                                            sh '''
                                        mkdir -p security-reports
                                        set +e
                                        checkov -d infra/security-baseline --framework terraform \\
                                            >security-reports/checkov-before.txt 2>&1
                                        before_status=$?
                                        set -e
                                        if [ "$before_status" -eq 0 ] || ! grep -Eiq 'CKV_AWS_|FAILED|failed' security-reports/checkov-before.txt; then
                                            cat security-reports/checkov-before.txt
                                            echo 'Checkov did not flag the intentionally vulnerable baseline.' >&2
                                            exit 1
                                        fi
                                        checkov -d infra/terraform --framework terraform \\
                                            --output json >security-reports/checkov-after.json
                                    '''
                                        }
                                    }
                                }

                                stage('Ansible lint') {
                                    steps {
                                        container('python') {
                                            sh 'ansible-lint infra/ansible/playbook.yml'
                                        }
                                    }
                                }
                            }
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
                                burst["k8s-build-" + slot] = {
                                    node('k8s-node') {
                                        echo "LAB9_POD_START slot=" + slot + " node=" + env.NODE_NAME
                                        container('node') { sh 'node --version' }
                                        sleep(time: 360, unit: 'SECONDS')
                                        echo "LAB9_POD_DONE slot=" + slot + " node=" + env.NODE_NAME
                                    }
                                }
                            }
                            parallel burst
                        }
                    }
                }
            }

            post {
                always {
                    archiveArtifacts artifacts: 'security-reports/**,lab7-evidence/**,lab8-evidence/**,backend/reports/junit.xml,backend/coverage/**,backend/playwright-report/**', allowEmptyArchive: true, fingerprint: true
                }
                success {
                    echo "✅ taskflow-api passed on branch " + env.BRANCH_NAME
                }
                failure {
                    echo "❌ taskflow-api failed at " + (env.STAGE_NAME ?: 'an earlier stage')
                }
            }
        }

        stage('Pipeline Health Gate — Last 20 Builds') {
            when {
                beforeAgent true
                branch 'main'
            }
            agent {
                kubernetes {
                    cloud 'kubernetes'
                    defaultContainer 'node'
                    yamlFile 'monitoring/kubernetes/lab10-api-agent.yaml'
                    retries 2
                }
            }
            steps {
                withEnv([
                    'PROMETHEUS_JOB_LABEL=' + env.JOB_NAME,
                    'LAB9_PROMETHEUS_URL=' + env.LAB9_PROMETHEUS_URL
                ]) {
                    sh 'node scripts/check-prometheus-health.mjs'
                }
            }
        }

        stage('Approval — Deploy Production') {
            when {
                beforeInput true
                branch 'main'
            }
            input {
                message 'The build gates passed and the last 20 builds meet the 90% success target. Deploy the green image to production?'
                ok 'Approve production'
                submitter 'jenkins'
            }
            steps {
                echo 'Production deploy approved.'
            }
        }

        stage('Deploy — Production') {
            when {
                beforeAgent true
                branch 'main'
            }
            agent {
                kubernetes {
                    cloud 'kubernetes'
                    defaultContainer 'node'
                    yamlFile 'monitoring/kubernetes/lab10-deploy-agent.yaml'
                    retries 1
                }
            }
            steps {
                container('tools') {
                    sh 'sh scripts/install-kubectl.sh'
                    sh 'sh scripts/run-lab7-blue-green.sh'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'lab7-evidence/**', allowEmptyArchive: true, fingerprint: true
                }
            }
        }

        stage('Lab 7 — Blue/Green Rollback Demonstration') {
            when {
                beforeAgent true
                allOf {
                    branch 'codex/lab7-green-blue'
                    expression { return params.LAB7_INJECT_FAILURE }
                }
            }
            agent {
                kubernetes {
                    cloud 'kubernetes'
                    defaultContainer 'node'
                    yamlFile 'monitoring/kubernetes/lab10-deploy-agent.yaml'
                    retries 1
                }
            }
            steps {
                container('tools') {
                    sh 'sh scripts/install-kubectl.sh'
                    sh 'sh scripts/run-lab7-blue-green.sh'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'lab7-evidence/**', allowEmptyArchive: true, fingerprint: true
                }
            }
        }
    }

    post {
        success {
            script {
                def message = "✅ " + env.JOB_NAME + " #" + env.BUILD_NUMBER + " (" + env.BRANCH_NAME + ") passed: " + env.BUILD_URL
                if (env.TASKFLOW_SLACK_CHANNEL?.trim()) {
                    try { slackSend(channel: env.TASKFLOW_SLACK_CHANNEL, color: 'good', message: message) }
                    catch (Exception error) { echo "Slack notification was unavailable: " + error.message }
                }
                if (env.TASKFLOW_CI_EMAIL_RECIPIENTS?.trim()) {
                    try { emailext(to: env.TASKFLOW_CI_EMAIL_RECIPIENTS, subject: "SUCCESS: " + env.JOB_NAME + " #" + env.BUILD_NUMBER, body: message) }
                    catch (Exception error) { echo "Email notification was unavailable: " + error.message }
                }
            }
        }
        failure {
            script {
                def message = "❌ " + env.JOB_NAME + " #" + env.BUILD_NUMBER + " (" + env.BRANCH_NAME + ") failed: " + env.BUILD_URL
                if (env.TASKFLOW_SLACK_CHANNEL?.trim()) {
                    try { slackSend(channel: env.TASKFLOW_SLACK_CHANNEL, color: 'danger', message: message) }
                    catch (Exception error) { echo "Slack notification was unavailable: " + error.message }
                }
                if (env.TASKFLOW_CI_EMAIL_RECIPIENTS?.trim()) {
                    try { emailext(to: env.TASKFLOW_CI_EMAIL_RECIPIENTS, subject: "FAILURE: " + env.JOB_NAME + " #" + env.BUILD_NUMBER, body: message) }
                    catch (Exception error) { echo "Email notification was unavailable: " + error.message }
                }
            }
        }
    }
}
