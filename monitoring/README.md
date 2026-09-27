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
   `kubernetes/node-pod-template.yaml`. Set the cloud's maximum instance count
   to **2** for the first burst.
4. Push this branch and run its multibranch job with the
   `LAB9_RUN_K8S_BURST` parameter enabled. The `Lab 9 — Kubernetes Burst Demo`
   stage requests ten agents and holds them for six minutes. With the cap at two,
   the remaining requests stay queued. The alert becomes active after
   five minutes. Raise the cloud cap to ten; the queue should drain and the
   alert should clear. Jenkins deletes the dynamic agent pods after each branch
   finishes.

The main pipeline still uses the existing `linux-build` agent for stages that
need its Docker socket and shared workspace. Only this explicit burst stage
uses Kubernetes, so the Lab 7 kind cluster and Docker-based release stages do
not lose their Docker access.

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

The queue alert uses the plugin's actual
`default_jenkins_executors_queue_length` metric and records the old
`jenkins_queue_size_value` name only as a compatibility alias. The SLO target
is at least 95% of completed builds under 360 seconds in the rolling 168-hour
window. The plugin's duration metric is a summary rather than a histogram; the
dashboard calculates p95 from the per-build duration gauges collected within
that window.

## Evidence

Save the requested screenshots in `monitoring/lab9-evidence/`:

- Jenkins build log with `LAB9_POD_START` and `LAB9_POD_DONE` entries, plus the
  kind namespace showing ephemeral agent pods.
- Prometheus/Grafana alert while the queue is held at a cap of two.
- The same alert cleared after raising the cap and draining the queue.
- Screenshot or export of the dashboard's three panels.
