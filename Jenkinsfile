pipeline {
    agent { label 'linux-build' }

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
        timeout(time: 10, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                echo "Building ${env.APP_NAME} with NODE_ENV=${env.NODE_ENV}"
                sh 'node --version'
                dir('backend') {
                    sh 'npm ci'
                }
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
                    image 'node:20-alpine'
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
                    image 'node:20-alpine'
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
                    API_PORT="$E2E_PORT" docker compose -p "taskflow-e2e-${BUILD_NUMBER}" up -d --build api

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
                        --add-host=host.docker.internal:host-gateway \\
                        -w "$WORKSPACE/backend" \\
                        -e TASKFLOW_API_URL="http://host.docker.internal:$E2E_PORT" \\
                        mcr.microsoft.com/playwright:v1.63.0-noble \\
                        bash -lc 'npm ci && npx playwright test'
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
            archiveArtifacts artifacts: '**/npm-debug.log*', allowEmptyArchive: true
        }
    }
}
