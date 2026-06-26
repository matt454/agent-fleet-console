# Fleet

Fleet is a local operator console for creating, monitoring, configuring, and operating Dockerized Hermes agents.

## Users

Primary users are technical operators running a personal fleet on a workstation. They need fast visibility into agent readiness, chat sessions, provider credentials, service health, VNC, terminal access, and lifecycle controls.

## Product Purpose

The console should make local Hermes fleets portable and understandable. A user should be able to clone the repository, run setup, create agents, configure model providers once, and operate the fleet without running setup manually inside every instance.

## Register

product

## Tone

Quiet, precise, useful. Prefer direct labels and visible system state over explanatory copy. The UI should feel like an operator tool, not a marketing surface.

## Principles

- Chat is the primary agent detail experience.
- Advanced controls use progressive disclosure.
- Each agent is managed independently from the console.
- Provider setup belongs in global settings.
- Runtime data, credentials, logs, and local database files must stay out of git.
- Motion exists only to explain state: preparing, active, talking, failed.
