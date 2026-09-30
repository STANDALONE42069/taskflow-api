# Lab 6 security gate

Jenkins scans the repository's Git history with Gitleaks, runs the ESLint security rules and Semgrep, audits dependencies with `npm audit --json`, generates a CycloneDX SBOM with Syft, signs and verifies it with a temporary local Cosign key, then asks OPA to evaluate `policy/security.rego`.

The audit parser treats missing or invalid npm audit JSON as an error. Lower severities are reported as warnings. OPA blocks the pipeline only when `metadata.vulnerabilities.critical` is greater than zero. The isolated `critical-demo` fixture exists only to exercise that decision; Jenkins audits its lockfile but never installs or executes that package.

## Critical CVE exercise

The isolated fixture's normal version is `praisonai@1.7.4`. For the red build, the dedicated `feature/lab6-cve-demo` branch temporarily downgrades its manifest and lock entry to `1.7.1`, an npm version reported as affected by critical advisories, including [GHSA-vmmj-pfw7-fjwp](https://github.com/advisories/GHSA-vmmj-pfw7-fjwp). Jenkins audits that lockfile only; it never installs or executes the package. After the red build, the branch is upgraded back to `1.7.4` and rebuilt to demonstrate the pass.

## SBOM signature

The build creates `taskflow-api.cdx.json`, a Cosign bundle, and the matching public key under `security-reports/`. Cosign verifies the bundle before Jenkins archives the files. The generated private key is deleted at the end of the signing stage and is not an artifact.
