# Node.js CI security baseline (2026-10-22)

Codex Receipts retains Node.js 22.12.0 as its declared minimum and isolated compatibility-test matrix entry. CI adds an explicit 22.23.4 security-release entry, requests the latest runtime for each selected version, and verifies security floors for the 22/24/26 supported entries. The minimum-version test is intentionally exempt from that floor. Package versions, engines, installation commands and release tags are unchanged.

Validation on the signed official Node.js 22.23.4 binary: 33 catalog unit tests; production and full package audits with zero vulnerabilities; package build, isolated CLI/MCP/HTML smoke tests and 20 mocked USB tests; dry-run package manifest with 96 files. Workflow YAML and guard accept/reject cases also passed. No physical printer was accessed.

Next: review all PR CI entries, including the unchanged minimum-version compatibility entry. This branch does not create a publish tag or release a package.

