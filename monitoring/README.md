# Lab 9: Kubernetes agents and Jenkins monitoring

This folder contains the reproducible source configuration for the Lab 9
Kubernetes-agent burst, Prometheus scrape, SLO rules, and Grafana dashboard.
It does not include Jenkins credentials or tokens.

## Jenkins Kubernetes cloud

1. Run `powershell -ExecutionPolicy Bypass -File
   monitoring/kubernetes/prepare-agent-credential.ps1`. It creates the isolated
   `jenkins-agents` namespace and a narrowly scoped service account, connects
   `jenkins-lab` to the existing `kind` Docker network, and writes a 24-hour
   kubeconfig to the Git-ignored `monitoring/secrets/` folder.
2. Add that kubeconfig to Jenkins as a **Secret file** credential. The cloud
   endpoint is `https://lab7-control-plane:6443`. Set the cloud's Jenkins URL to
   the `http://<jenkins-lab-IP-on-kind>:8080/` value printed by the script and
   enable WebSocket so agent pods can reach the controller over HTTP. Keep the
   token out of Git and chat; rerun the script to renew it after 24 hours.
3. In **Manage Jenkins → Clouds**, add a Kubernetes cloud using namespace
   `jenkins-agents`, that credential, and the existing kind API endpoint. Add a
   pod template with label `k8s-node`, container name `node`, and the contents of
    `kubernetes/node-pod-template.yaml`. Set both the cloud and pod template
    **Concurrency Limit** to **2** for the first burst.
4. Push this branch and run its multibranch job with the
   `LAB9_RUN_K8S_BURST` parameter enabled. The `Lab 9 — Kubernetes Burst Demo`
   stage requests ten agents and holds them for six minutes. With the cap at two,
    the remaining requests stay queued. The alert fires after the oldest item
    has waited more than two minutes for a further five minutes. Raise both
    concurrency limits to ten; the queue should drain and the alert should
    clear. Jenkins deletes the dynamic agent pods after each branch finishes.

The `Install` stage runs `npm ci` and unit tests in a fresh Kubernetes pod.
The existing `linux-build` agent remains available for later stages that need
its Docker socket and shared workspace; `Prepare Docker-dependent checks`
recreates dependencies in that workspace. The burst stage also uses ephemeral
Kubernetes pods.

## Prometheus and Grafana

Install the Jenkins **Prometheus metrics** plugin and verify that
`http://localhost:8081/prometheus/` responds with metrics. Configure it to
collect metrics every 15 seconds and per-build metrics with a maximum age of
168 hours and the job label `jenkins_job`. The seven-day SLO and p95 panels use
those per-build series.

From this repository, start the local monitoring pair with:

```powershell
docker compose -f monitoring/docker-compose.yml up -d
```

Prometheus is at <http://localhost:9090>; Grafana is at <http://localhost:3000>
(initial local-only login: `admin` / `lab9-grafana-local`). The datasource and
dashboard are provisioned automatically. Both ports bind to loopback only.

By default, Jenkins must allow the local Prometheus request to read the metrics
endpoint. If the endpoint is protected, create a dedicated Jenkins account with
`Metrics/View`, issue an API token, and mount that token as
`monitoring/secrets/jenkins-prometheus-token` (ignored by Git). Then uncomment
the `basic_auth` block in `prometheus/prometheus.yml`. Do not use an admin or
GitHub token for scraping.

Copy `jenkins/lab9-observability.init.groovy` into
`JENKINS_HOME/init.groovy.d/` and restart Jenkins. It enables per-build metrics
with a 168-hour retention window, sets 15-second collection, and exports the
live `taskflow_lab9_oldest_queue_wait_seconds` gauge. The backlog alert fires
only when the oldest queued item has already waited over 120 seconds for a
further five minutes. `jenkins_queue_size_value` is supplied directly by the
metrics plugin and drives the queue panel. The SLO target is at least 95% of
completed TaskFlow pipeline builds under 360 seconds in the rolling 168-hour
window. The plugin's duration metric is a summary rather than a histogram; the
dashboard calculates p95 from the per-build duration gauges collected within
that window.

## Evidence

The requested evidence is saved in `monitoring/lab9-evidence/`:
PNG screenshots are local deliverables and are intentionally ignored by Git.

- `Jenkinsfile.diff` shows the Kubernetes Install agent and burst stage.
- `jenkins-queue-cap2.png` and `kubernetes-pods-running.txt` show the saturated
  queue and live ephemeral pods.
- `prometheus-queue-alert-firing.png` and
  `prometheus-queue-alert-cleared.png` show the alert transition.
- `jenkins-queue-cleared-cap10.png` shows that the queue drained.
- `grafana-dashboard-queue8.png` and `grafana-dashboard-queue0.png` show all
  three populated panels before and after the queue drained.
- `jenkins-build3-success.png` shows the successful ten-request burst build.
- `grafana/dashboards/jenkins-health.json` is the importable dashboard JSON.
