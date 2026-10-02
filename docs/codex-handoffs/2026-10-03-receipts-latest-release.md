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

## Published release

- Source commit: `3cadac0c61cc132b63eade9d23482ab61c23300f`.
- All four source CI jobs passed in
  [run 37050477890](https://github.com/iamxoghks/skills/actions/runs/37050477890).
- Release tag: `codex-receipts-v1.3.0`.
- The public npm version and `latest` tag are both
  [1.3.0](https://www.npmjs.com/package/codex-receipts/v/1.3.0).
- Registry tarball SHA-1 is `c78ba0aba3a72bf9b4d303f7d24eec179c48a20a`,
  identical to the locally tested tarball; npm provenance is present.
- Independent packed-consumer checks passed on Node 22.12 and 24, including
  strict public declaration checking with `skipLibCheck: false`.
- A fresh install from the public npm registry passed the real CLI, fixture
  MCP, and 20 USB checks on Node 24; its full dependency audit was zero.

GitHub created two publish runs for the same tag. Run 37050728775 uploaded
successfully before its cancellation completed; its Publish step succeeded.
Run 37050725617 then failed with E409 while npm was processing the same version.
The public registry confirms successful publication. Do not re-publish this
version in response to the failed duplicate. The release workflow now queues
runs for each tag without canceling an active publisher.

The catalog skill and both catalog READMEs now pin 1.3.0.

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
