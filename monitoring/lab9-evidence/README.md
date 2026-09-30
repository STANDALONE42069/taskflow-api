# Lab 9 delivery evidence

PNG screenshots are local deliverables and are intentionally ignored by Git.

The Jenkins multibranch job is `taskflow-lab4/codex%2Flab9-k8s-metrics`.
Build [#2](http://localhost:8081/job/taskflow-lab4/job/codex%252Flab9-k8s-metrics/2/console)
finished successfully with `npm ci` and unit tests in a Kubernetes pod.
Build [#3](http://localhost:8081/job/taskflow-lab4/job/codex%252Flab9-k8s-metrics/3/console)
finished successfully after the ten-request burst. Its `LAB9_POD_START` and
`LAB9_POD_DONE` entries cover all ten slots.

## Requested files

- `Jenkinsfile.diff`: change from the Lab 8 Jenkinsfile to the Lab 9 pipeline,
  including the Docker-to-Kubernetes Install stage change.
- `../grafana/dashboards/jenkins-health.json`: importable Grafana dashboard JSON
  with success rate, p95 build duration, and queue length panels.
- `grafana-dashboard-queue8.png` and `grafana-dashboard-queue0.png`: populated
  dashboard with the queue saturated and after it drained.
- `prometheus-queue-alert-firing.png`: `JenkinsQueueBacklog` firing with
  `taskflow_lab9_oldest_queue_wait_seconds > 120` for five minutes.
- `prometheus-queue-alert-cleared.png`: the same rule inactive after increasing
  both cloud and pod-template concurrency limits from two to ten.

## Supporting evidence

- `jenkins-queue-cap2.png`: eight requests waiting with the concurrency cap at
  two; `jenkins-queue-cap2-full.png` also shows the two running agents.
- `jenkins-queue-cleared-cap10.png`: empty queue after increasing both limits.
- `jenkins-build3-success.png`: final successful Jenkins build #3.
- `kubernetes-pods-running.txt`: live `jenkins-agents` namespace pods during
  the burst; `kubernetes-pods-after.txt`: no pods after the build completed.
- `build2-kubernetes-ci.txt` and `build3-burst-success.txt`: selected console
  lines showing pod creation, all burst slots, and final success results.

The independent `JenkinsBuildDurationSLO` alert remained firing because the
rolling seven-day history was below the configured 95% under-six-minute
target. The queue alert cleared as required.
