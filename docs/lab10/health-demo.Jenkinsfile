// Runs the production health check against real metrics, without deploying.
pipeline {
    agent {
        kubernetes {
            cloud 'kubernetes'
            defaultContainer 'node'
            yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-agent
  automountServiceAccountToken: false
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
    - name: node
      image: node:24-alpine3.24
      command: ["sh", "-c", "cat"]
      tty: true
      resources:
        limits:
          cpu: 500m
          memory: 256Mi
'''
        }
    }
    environment {
        LAB9_PROMETHEUS_URL = 'http://lab9-prometheus:9090'
        PROMETHEUS_JOB_LABEL = 'taskflow-lab4/main'
        PROMETHEUS_JOB_PATTERN = 'taskflow-lab4/.*'
    }
    stages {
        stage('Pipeline Health Gate — Last 20 Builds') {
            steps {
                sh 'node scripts/check-prometheus-health.mjs'
            }
        }
        stage('Deploy — Production (demonstration only)') {
            steps {
                echo 'The health gate passed. This evidence job never changes production.'
            }
        }
    }
}
