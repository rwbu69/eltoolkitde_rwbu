# Contributing to ElToolkitDeRWBU

Thank you for taking the time to contribute. Bug reports, documentation fixes,
and small improvements are welcome. For a new feature or a large refactor,
please open an issue first so the scope can be discussed before implementation.

## Before you start

- Check existing issues and pull requests for related work.
- Read the [README](README.md) and [security policy](SECURITY.md).
- Do not include copyrighted media, credentials, cookies, or personal data in
  issues, tests, screenshots, or pull requests.

## Development setup

### Requirements

- Node.js 24 and npm
- Rust stable and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
- Python 3.11+ only when rebuilding the BPM sidecars

Install dependencies with the lockfile:

```bash
npm ci
```

See the README for sidecar preparation and platform-specific requirements.

## Useful commands

```bash
npm test
npm run lint
npm run vite:build
npm run dev
```

Run the smallest relevant checks before opening a pull request. Changes to
Rust/Tauri configuration should also be checked with `cargo check` from
`src-tauri`.

## Pull requests

1. Keep each pull request focused on one problem.
2. Explain the user-visible change and how it was tested.
3. Include screenshots or a short recording for UI changes.
4. Update the README or changelog when behavior or release-facing features
   change.
5. Do not commit generated build output, sidecar binaries, or secrets.
6. Keep the existing license and third-party notices intact.

Pull requests are reviewed by a small maintainer team, so response times may
vary. Passing CI does not guarantee that a change will be merged.

## Commit messages

Use a short, imperative subject, for example:

```text
Improve retry feedback for failed downloads
```

## Questions

For general questions, open an issue with enough context to reproduce the
problem. For security-sensitive reports, follow [SECURITY.md](SECURITY.md)
instead of opening a public issue.
