# Contributing

Thanks for helping improve Fleet.

## Local Setup

```bash
npm run setup
npm start
```

For development:

```bash
npm run dev
```

## Release Hygiene

Before opening a pull request, run:

```bash
npm run release:check
```

Keep source files focused and under 250 lines. Runtime state, local databases, logs, generated secrets, and local Hermes checkouts must stay ignored.

## Codebase Guide

Read [docs/codebase.md](docs/codebase.md) for the architecture overview and [docs/patterns.md](docs/patterns.md) for implementation patterns before making larger changes.

## Code Style

- Prefer small modules with explicit inputs.
- Keep side effects at the edges: setup scripts, route registration, Docker wrappers.
- Redact credentials in logs and API responses.
- Add comments only when they explain non-obvious behavior.
