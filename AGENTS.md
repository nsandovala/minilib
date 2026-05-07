# Agent System

This project uses an agent-based orchestration system defined in the `agents/` directory.

## Commands

| Command | Description |
|---------|-------------|
| scaffold | Scaffold new components or features |
| validate-db | Validate database schema and integrity |
| review | Run code review checks |
| test-gen | Generate tests |
| release | Prepare a release |

## Agents

| Agent | Role | Path |
|-------|------|------|
| orchestrator | Route commands to specialized agents | `agents/orchestrator/router.py` |

## Rules

All agents must follow the global rules defined in [`agents/.rules`](agents/.rules).
