# Lab 10 - Jenkins setup and acceptance

The capstone uses the API repository at `STANDALONE42069/taskflow-api` and the
Flutter repository at `STANDALONE42069/taskflow-mobile`. Keep `main` protected
and require review for pipeline and deployment-permission changes.

## Jenkins and Kubernetes

1. Configure a Kubernetes cloud named `kubernetes` from the Lab 9 kind cluster.
   Use namespace `jenkins-agents`, the Jenkins controller URL reachable from
   kind, and WebSocket agent connections. Keep the existing `k8s-node` label
   template for the Lab 9 burst. The local cloud and pod-template caps are 10
   so the burst can request ten agents; size these limits to the cluster.
2. Apply `monitoring/kubernetes/lab10-deploy-rbac.yaml` as a cluster
   administrator. It creates `jenkins-deployer` and grants it deployment,
   service, pod, pod-log, and event access only in the `default` namespace.
   Verify that it can patch the TaskFlow deployment and Service in `default`,
   and cannot create nodes or change resources in other namespaces.
3. The regular API and mobile build pods disable service-account token mounts.
   The production deploy pod uses `jenkins-deployer` only for the rollout. The
   Jenkins Kubernetes cloud still needs its Lab 9 credential to create pods in
   `jenkins-agents`.
4. Attach `lab7-registry` and `lab9-prometheus` to the Docker `kind` network.
   The pipeline pushes to `lab7-registry:5000` and queries
   `lab9-prometheus:9090` by DNS. The kind container runtime resolves
   `localhost:5001` image references through its registry mirror.
   Build `monitoring/kubernetes/lab10-tools.Dockerfile` as
   `localhost:5001/taskflow-lab10-tools:2` and push it to the local registry.
   The API image builder is Kaniko inside a restricted pod; the kind namespace
   baseline PodSecurity policy does not allow rootless BuildKit's unconfined
   seccomp setting.

## Prometheus health gate

In Jenkins, create a read-only `prometheus` service account with Overall/Read
and Metrics/View. Create its API token, put only the token in the ignored local
file `monitoring/secrets/jenkins-prometheus-token`, then uncomment `basic_auth`
in `monitoring/prometheus/prometheus.yml`. Do not commit the token. Start
`monitoring/docker-compose.yml` after the kind network exists. In the Jenkins
Prometheus plugin, enable per-build metrics, retain them for 168 hours, collect
every 15 seconds, and use the `jenkins_job` label. The gate reads the most
recent 20 completed build records across branches of the API multibranch project
(`taskflow-lab4/.*`), ordered globally by start time. Running builds are excluded.
It fails
closed if fewer than 20 records are available or if the success rate is below
90 percent. `DEPLOY_PRODUCTION=false` runs CI without promotion; requesting
production requires `DEPLOY_PRODUCTION=true`, the same health check, and admin
approval. A failed health check prevents both approval and production deployment.
Do not edit build results or inject success metrics to clear this gate.

## Jenkins integrations

- Configure a SonarQube server named `SonarQube`; keep its token in the Jenkins
  credential used by `withSonarQubeEnv`. Configure the SonarQube webhook to the
  Jenkins SonarQube webhook endpoint so `waitForQualityGate` can resume.
- Configure either Slack or Email Extension notifications. Set the Jenkins
  global environment variable `TASKFLOW_SLACK_CHANNEL` or
  `TASKFLOW_CI_EMAIL_RECIPIENTS`. Notifications include the branch and build
  URL. The local lab currently uses Mailpit at `taskflow-lab10-mailpit:1025`,
  with inbox `lab10@taskflow.test` and web UI on `http://localhost:8025`.
- The API pipeline uses the local kind registry through
  `LAB7_REGISTRY_PUSH_ENDPOINT`; the mobile pipeline does not publish packages.

## Mobile signing credentials

Create the following Jenkins credentials without placing any signing values in
Git:

| Credential ID | Jenkins type | Contents |
| --- | --- | --- |
| `taskflow-mobile-android-keystore` | Secret file | Android release keystore |
| `taskflow-mobile-android-store-password` | Secret text | Keystore password |
| `taskflow-mobile-android-signing-key` | Username with password | Username is the key alias; password is the key password |

The mobile `main` branch checks the keystore and alias with `keytool` before it
builds a signed release AAB. Every branch builds a debug APK. This local lab
uses a self-signed, lab-only release keystore because no production key was
provided. Replace all three credentials with owner-controlled release signing
material before distributing an app. The local backup is under
`%LOCALAPPDATA%/TaskFlowLab10`, outside Git.

## Live walkthrough evidence

Capture the API and mobile Jenkins stage views, the Flutter APK artifact, the
SonarQube gate, the Prometheus health-gate query, and the blue/green rollback
log. For the bad-change demonstration, use the reviewer-assigned change and
show the specific gate that rejects it before promotion. The Lab 7
`LAB7_INJECT_FAILURE` parameter also demonstrates a failed image rollout and
automatic Service-selector rollback on the `codex/lab7-green-blue` branch.
