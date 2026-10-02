# Codex Receipts 1.3.0 major dependency upgrade — 2026-10-03

## Result and compatibility

This supersedes the compatible-only refresh recorded in
[the dependency handoff](2026-10-03-receipts-dependencies.md). Every direct
production and development dependency was moved to its latest stable release
available during this update. `npm outdated --json` returned an empty object.
The package and lockfile version are 1.3.0.

- Minimum Node.js is now 22.12.0 because Commander 15 requires it.
- TypeScript 7 uses `NodeNext` module and resolution settings with explicit
  Node ambient types. Emitted application code still targets ES2022.
- USB 3 replaces the removed Legacy API with asynchronous WebUSB discovery,
  interface selection, transfer validation, and cleanup. Linux kernel drivers
  detached for printing are restored. Existing USB, TCP, and CUPS interface
  command syntax remains supported.
- Smoke tests always use disposable synthetic Codex sessions. CLI and real
  stdio MCP checks cover session discovery, filtering, token counts, Korean
  receipts, and invalid arguments without reading personal session content.
- The USB suite includes actual native module loading without device access
  and 19 mocked routing, transfer, error, and cleanup scenarios.

## Validation and limits

Local checks passed on macOS using Node 22.12.0, 24.19.0, and 26.10.0:
TypeScript build, CLI/MCP smoke checks, and the USB suite. Production and full
dependency audits reported zero findings. All 33 repository unit tests passed.
The 96-file npm tarball was checked for expected contents and private paths.
The minimum-runtime installation was tested from a clean dependency tree.

Physical printer output was not exercised. Native loading and mocked driver
behavior do not establish real-device compatibility. Audit results reflect
the advisory database at the time of the check.

## Release and resume

GitHub CI now tests the package on Node 22.12.0, 24, and 26. The trusted npm
publisher uses a fresh Node 24 and the current npm CLI, and verifies that the
tag matches `package.json`. Release through `codex-receipts-v1.3.0` only after
all CI checks succeed, then verify the registry installation and update the
catalog skill's pinned version.

```sh
npm --prefix packages/codex-receipts ci
npm --prefix packages/codex-receipts audit --omit=dev
npm --prefix packages/codex-receipts audit
npm --prefix packages/codex-receipts test
npm --prefix packages/codex-receipts pack --dry-run
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

The repository root and package `AGENTS.md` contain the canonical release
rules. Do not publish with a local npm token or skip the trusted workflow.
