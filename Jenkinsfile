pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            label 'linux-build'
        }
    }

    environment {
        APP_NAME = 'taskflow-api'
        NODE_ENV = 'test'
        CI = 'true'
        NPM_CONFIG_CACHE = "${env.WORKSPACE}/.npm-cache"
    }

    options {
        // A hung install or test must not occupy an executor forever; cap the whole run.
        timeout(time: 10, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
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
            steps {
                dir('backend') {
                    sh 'npm test'
                }
            }
            post {
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
