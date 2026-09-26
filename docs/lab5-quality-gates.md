# Lab 05 — Automated Testing and Quality Gates

The `taskflow-lab4` multibranch job runs these gates for each branch:

1. Install and lint the API with Node.js 20.
2. Run Jest and publish JUnit and Cobertura reports to Jenkins.
3. Upload the LCOV report to SonarQube and wait for the quality gate. The `Taskflow Lab 5 70%` gate must fail below 70% coverage.
4. Start the API with Docker Compose, run three Playwright API checks, and archive the JUnit and HTML reports.
5. Keep the Lab 04 branch-based staging and production stages after the quality gates.

## Jenkins and SonarQube setup

- Install the Jenkins **Coverage** plugin. The **SonarQube Scanner** plugin is already part of the Lab 02 plugin set.
- Run SonarQube Community at port 9000. From Jenkins containers, configure the server URL as `http://host.docker.internal:9000` and name the server `SonarQube`.
- Store the project analysis token in a Jenkins Secret text credential with ID `sonar-token`; select it in the SonarQube server configuration.
- Create the SonarQube project with key `taskflow-api` and assign it a quality gate whose overall-code condition is `Coverage is less than 70`.
- Add a SonarQube webhook at `http://host.docker.internal:8081/sonarqube-webhook/` so `waitForQualityGate` receives the analysis result.
- The scanner reads `backend/coverage/lcov.info`; Jenkins publishes `backend/coverage/cobertura-coverage.xml` and `backend/reports/junit.xml`.

## Demonstration

The initial feature-branch build omits `backend/tests/quality-coverage.test.js`. Its existing tests pass, but coverage is below the SonarQube threshold, so the build must stop in **Quality Gate**. Restore the coverage tests and push again; the passing run should publish test trends, pass the quality gate, and finish all three Playwright checks.

The end-to-end suite uses a fresh Docker Compose API container and checks listing, creating, and completing a task. Jenkins archives the Playwright HTML report and publishes the E2E JUnit results.
