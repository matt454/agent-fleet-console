# Operator Guide

This guide covers the workflows Fleet supports after setup is complete.

## Dashboard

The dashboard is the primary operator surface. It combines local and remote Fleet node data into one view and shows:

- agent name and display name
- host or node label
- runtime
- state and pending job state
- service count and running service count
- memory readiness
- provider and capability summaries
- endpoint availability
- update and drift status

Use row actions for common lifecycle work. Open an agent detail view when you need chat, gateway access, credentials, terminal, crons, jobs, or diagnostics.

## Creating Agents

Click **New agent** from the dashboard. Choose:

- target node: local or an enabled remote Fleet node
- runtime: Docker Hermes or NemoHermes sandbox
- agent name
- Camofox browser sidecar for Docker agents
- optional Telegram setup
- optional capabilities, such as payments when enabled by the app surface

Create jobs run asynchronously. The dashboard and jobs panel show progress while Docker images, compose files, provider config, credentials, ports, and sidecars are prepared.

New agents inherit fleet-wide provider defaults and shared credentials at creation time.

## Agent Names

Docker Hermes agents allow:

```text
lowercase letters, numbers, hyphens, and underscores
```

NemoHermes sandbox agents allow:

```text
lowercase letters, numbers, and hyphens
```

Names can be up to 63 characters and must start and end with a lowercase letter or number.

## Provider Defaults

Open **Fleet settings -> Model & auth** to configure the default provider for new and synced agents.

Bundled provider choices:

- OpenAI Codex
- Ollama
- Custom endpoint
- OpenRouter

The default provider is saved to:

```text
secrets/global-provider.json
```

When a provider config is applied to an agent, it updates:

```text
<agent>/home/config.yaml
```

For local model providers such as Ollama, Fleet normalizes host-machine URLs for container use when needed. For example, a local host URL can be converted so the agent container can reach it.

## Codex Device Login

For OpenAI Codex provider auth, start device login from **Fleet settings -> Model & auth**. Fleet stores the resulting auth state under:

```text
secrets/global-oauth/
```

This does not automatically mutate every existing agent. Use **Sync agents** or select specific agents to copy the auth state into their Hermes credential pools.

After sync, running agents are restarted so they reload the updated provider and auth state.

## Shared Credentials

Open **Fleet settings -> Credentials** to store API keys or other provider env values. Fleet validates key names and rejects dangerous runtime keys.

Credentials are saved to:

```text
secrets/global-credentials.env
```

Agent sync copies them into:

```text
<agent>/home/.env
```

The UI and API return redacted summaries, not raw secret values.

Use shared credentials for values that should be inherited by many agents. Use per-agent credentials when one agent needs a different key, account, or endpoint.

## Syncing Agents

Sync copies current fleet-wide provider defaults, shared credentials, and applicable auth material into selected agents.

Use sync after:

- changing the default model provider
- adding or removing API keys
- completing Codex device login
- importing global config from a backup bundle

Running agents are restarted by sync so containers reload environment values.

## Chat And Sessions

Open an agent detail view and use the chat panel to:

- list sessions
- read session messages
- send a new chat turn
- continue an existing session
- stop a running chat turn when supported

Fleet routes chat through the selected node. Remote agents use the remote Fleet node API, so the coordinator does not need direct access to the remote agent container.

`HERMES_CONSOLE_MAX_CHAT_MESSAGE_CHARS` controls the maximum inbound chat message size accepted by the API.

## Gateway

The gateway panel exposes operator entry points for an agent:

- Hermes dashboard
- Camofox VNC
- static web preview
- terminal
- chat history

Fleet also reports gateway diagnostics, including advertised URL, effective URL, reachability, HTTP status, reason, and checked time.

Terminal access uses short-lived, single-use tickets issued by the API. When console auth is enabled, websocket upgrades still require the console token.

## Terminal

The in-app terminal opens a shell into the agent container using a websocket ticket. For local terminal escape hatches outside the UI:

```bash
bin/hermes-docker shell <agent>
bin/hermes-docker hermes <agent> --help
```

Use terminal access as an administrator capability. It can read or modify agent workspace and runtime files.

## Static Web Publishing

Each Docker agent gets a Node.js webhost sidecar. To publish a simple page, write static files to:

```text
<agent>/workspace/web/
```

Inside the agent container, that path is:

```text
/opt/data/workspace/web
```

Use `index.html` as the default page and relative paths for assets. Fleet writes current URLs and instructions to:

```text
<agent>/workspace/HERMES_WEB.md
```

The agent environment includes:

```text
HERMES_WEB_ROOT
HERMES_WEB_URL
HERMES_WEB_LAN_URL
```

The Web tab in the gateway panel opens the LAN URL.

## Lifecycle Jobs

Fleet queues longer operations as jobs:

- create
- start
- stop
- restart
- update
- delete
- clone
- backup export
- backup restore
- global config sync
- session chat fallback jobs
- Telegram setup

Jobs have status, progress, output, error text, timestamps, and optional node metadata. The API exposes recent jobs and individual job status.

Risky actions require confirmation from the UI or API payload. Start is the only lifecycle action that does not require risk confirmation.

## Backups

Open **Fleet settings -> Backups** or the agent lifecycle panel.

Backup archives are written to:

```text
data/backups/
```

By default, backups include:

- selected agent config
- `SOUL.md`
- selected workspace files
- provider defaults
- manifest metadata

By default, backups exclude:

- `home/.env`
- global credentials
- OAuth state
- token-like files
- generated runtime secrets
- local database files

Only include secrets when moving trusted local state between machines and you understand the archive handling risk.

## Restore

Restore accepts a local `.tar.gz` path on the console host. Fleet inspects archives before restore and rejects unsafe tar entries such as absolute paths, parent traversal, symlinks, and hardlinks.

Restored agents receive fresh generated ports and runtime secrets. Source `compose.yaml` and `instance.env` are not reused directly.

If an archive contains names that already exist, restore with a prefix.

## Clone

Clone duplicates an existing local agent into a new name. Clone can copy workspace files and, because it stays local, can optionally copy per-agent credentials.

Use clone when you want a known-good agent shape with fresh ports and independent runtime identity.

## Fleet Nodes

Open **Fleet settings -> Fleet nodes** to add another Fleet console.

Each node has:

- label
- base URL
- enabled state
- optional bearer token
- health/test status
- console version and revision metadata when reachable

When a remote node is enabled, the dashboard includes its agents. Most row and detail actions are routed through the remote node API:

- create
- lifecycle actions
- display name updates
- clone
- backup export and download
- gateway
- chat and sessions
- terminal ticket creation
- crons
- credentials summary
- payment policy reads
- console self-update status when allowed

Remote node tokens are stored in the local SQLite database and redacted in responses. Use Fleet nodes only on trusted networks.

## NemoHermes Agents

NemoHermes sandbox agents use the `nemohermes` runner on the target machine. Relevant environment values:

```env
NEMOHERMES_BIN=nemohermes
NEMOHERMES_AUTO_INSTALL=1
NEMOHERMES_INSTALL_COMMAND=curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
NEMOHERMES_INSTALL_TIMEOUT_MS=300000
```

If the runner is missing and auto-install is enabled, the create job tries the install command once. On locked-down hosts, set:

```env
NEMOHERMES_AUTO_INSTALL=0
```

Then install the runner manually or set `NEMOHERMES_BIN` to an absolute path.

The create modal can switch the fleet provider to an Ollama-compatible default when the NemoHermes runtime requires local model access.

## Telegram Agents

Telegram setup can be started during agent creation or later from the agent integration flow.

The onboarding flow creates a pairing session, displays a QR/deep link, polls for readiness, then stores:

- bot token
- bot username
- trusted user ID
- allowed user IDs
- home channel

Telegram credentials are written into the target agent configuration through an asynchronous setup job.

## Payments Capability

Fleet can surface payment capability metadata for agents that have the configured payments skill and client path:

```text
official/payments/mpp-agent
mppx
hermes-payments
```

Payment policy reads and writes are scoped per agent. Treat payment configuration as high-risk operational state and keep credential files private.

## Direct Wrapper Operations

Use wrappers when the UI is unavailable or you need direct local Docker access:

```bash
bin/hermes-docker status <agent>
bin/hermes-docker logs <agent>
bin/hermes-docker shell <agent>
bin/hermes-docker restart <agent>
bin/hermes-docker memory-status <agent>
bin/hermes-docker memory-repair <agent>
bin/hermes-docker browser-save <agent>
```

`bin/hermes-console` loads the standard Fleet env files and starts the console with the configured host and port.

## Troubleshooting

Run setup checks:

```bash
npm run init:baseline
```

Check local Docker state:

```bash
bin/hermes-docker status <agent>
docker compose version
docker ps
```

Check jobs from the UI or API:

```text
GET /api/jobs
GET /api/jobs/:id
```

Common fixes:

- Restart Docker when compose commands hang or fail.
- Re-run `npm run setup` after moving the repository.
- Confirm `HERMES_AGENT_SRC` points to a valid checkout before creating or updating Docker agents.
- Set `HERMES_CONSOLE_TOKEN` before binding outside localhost.
- Sync agents after changing provider defaults or shared credentials.
- Restart an agent after manual edits to `home/.env` or `home/config.yaml`.
