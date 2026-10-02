# Codex Receipts dependency refresh — 2026-10-03

## Purpose and result

The production dependency audit reported six findings against the previous
lockfile. Refreshing dependencies within the existing supported major versions
removed those findings. Both the direct minimum versions in `package.json` and
the resolved tree in `package-lock.json` were updated.

The package version remains 1.2.11. This is a source update; an npm release is a
separate operation through the repository's trusted publishing workflow.

## Compatibility decisions

- MCP SDK 1.32.0 and Zod 4.6.5 remain within their existing major versions.
- Commander stays on 14.0.3. Version 15 requires Node 22.12 or newer, beyond
  the package's current Node 22.0 minimum.
- USB stays on 2.18.0. The [USB 3 implementation](https://github.com/node-usb/node-usb-rs#apis)
  removes the Legacy API used by the printer code. A future major upgrade
  requires a printer implementation migration and device verification.
- TypeScript stays on 5.9.3. A [TypeScript 7 migration](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-beta/)
  must replace the current `moduleResolution: "node"` configuration and verify
  the built CLI and MCP entry points under the supported Node versions.
- The Node engine declaration and application source were preserved.

## Validation

Completed locally using Node 24.19.0:

- Clean `npm ci` installation and `npm audit --omit=dev`: zero findings.
- `npm test`: TypeScript build and existing CLI/rendering smoke tests passed.
- An isolated, disposable session/config fixture verified MCP initialization,
  tool discovery, session listing, Korean receipt generation, token counts,
  and rejection of an invalid session-list limit. It did not request HTML
  writes or printing. Fixture overrides were test-only and were not bundled.
- USB's native module loaded and the existing Legacy API exports were present.
- `npm pack --dry-run`: expected package contents were available.
- Repository unit suite: 33 tests passed.

Physical printer output was not exercised. Audit results reflect the advisory
database at the time of the check.

## Resume

Read the root and package `AGENTS.md`, then use the package commands:

```sh
npm --prefix packages/codex-receipts ci
npm --prefix packages/codex-receipts audit --omit=dev
npm --prefix packages/codex-receipts test
npm --prefix packages/codex-receipts pack --dry-run
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

The existing session-dependent smoke checks use local Codex data when present.
For isolated verification, use disposable session/config fixtures instead of
personal session content. Before an npm release, follow the version/tag rules
in `AGENTS.md` and update the catalog skill's pinned CLI version after publishing.
