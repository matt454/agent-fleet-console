# Security Policy

## Supported Versions

The project is pre-1.0. Security fixes target the current `main` branch unless a release branch is documented later.

## Reporting Vulnerabilities

Please report vulnerabilities privately before opening a public issue. Use GitHub private vulnerability reporting:

```text
https://github.com/matt454/agent-fleet-console/security/advisories/new
```

If private vulnerability reporting is unavailable, open a public issue titled `Security contact request` without exploit details, secrets, logs, tokens, or proof-of-concept payloads.

In private reports, include:

- affected version or commit
- steps to reproduce
- expected impact
- any safe proof-of-concept details

Do not include live API keys, OAuth tokens, private keys, or customer data in reports.

## Local Secrets

Runtime secrets belong in ignored local files only:

- `.env`
- `secrets/`
- per-agent `home/.env`
- per-agent `instance.env`

The console binds to `127.0.0.1` by default. Set `HERMES_CONSOLE_TOKEN` and `HERMES_CONSOLE_REQUIRE_AUTH=1` before binding to `0.0.0.0` or placing the console behind a public proxy.

The server refuses to start on a non-loopback bind unless `HERMES_CONSOLE_TOKEN` is set. Treat the console as a full control plane: it can start containers, stop containers, update agents, open terminals, sync credentials, restore backups, and coordinate remote Fleet nodes.

## Multi-Machine Fleet Security

Fleet Nodes are intended for trusted local networks or VPNs. Remote bearer tokens are optional for LAN convenience, but recommended. When configured, remote bearer tokens are stored plaintext in the local SQLite database and redacted from API responses. Protect `data/fleet.db`, backups, and host filesystem access accordingly.

The coordinator proxies lifecycle actions, agent creation, credential sync, chat/detail views, terminals, backups, and console update requests to remote nodes. Every remote node should have its own `HERMES_CONSOLE_TOKEN` before binding to `0.0.0.0`.

## High-Risk Operations

Console self-update is disabled by default. It runs git/npm commands in the repository and can restart the process, so enable it only for trusted admin-only deployments:

```env
HERMES_CONSOLE_ALLOW_SELF_UPDATE=1
```

Terminal websocket tickets are short-lived and single-use. When console auth is enabled, websocket upgrades must also include the console token.

Backup restore validates tar members before extraction and rejects absolute paths, parent traversal, symlinks, and hardlinks. Restores can still overwrite agent data by design, so only restore archives from trusted administrators.

Run `npm run audit:release` before publishing changes.
