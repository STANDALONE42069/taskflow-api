# Lab 04 branch strategy

```mermaid
flowchart LR
    F["feature/health-endpoint<br/>Install → Lint → Unit Test<br/>Skip both deploy stages"]
    P["PR → develop<br/>Separate PR job<br/>Skip both deploy stages"]
    D["develop<br/>Install → Lint → Unit Test<br/>Deploy — Staging automatically"]
    M["main<br/>Install → Lint → Unit Test<br/>Approval → Deploy — Production"]
    F -->|Open PR| P
    P -->|Merge| D
    D -->|Merge PR| M
```

GitHub `push` and `pull_request` events are delivered to `/github-webhook/` and trigger the Multibranch Pipeline. Branch discovery includes all lab branches, and origin PR discovery creates a distinct `PR-<number>` job.

`when { branch 'develop' }` enables staging. Production uses `branch 'main'`, `beforeInput true`, and the input message `Deploy to production?`. Evaluating the branch condition before input prevents feature, PR and develop builds from waiting for a production approval.

Both deploy stages use the lab's echo commands. They do not deploy an application to an external production service.

The public tunnel exposes only signed webhook POSTs through a gateway. Jenkins administration stays at `http://localhost:8081/`. A quick tunnel URL may change when its process restarts; update the GitHub webhook URL if it changes.
