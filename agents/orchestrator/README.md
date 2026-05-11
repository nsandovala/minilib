# Liev Internal Dev Orchestrator

A lightweight, deterministic local orchestrator for development workflows. It is built strictly with Python 3 and system utilities, without any AI dependency or external APIs. 

## Philosophy
- **Deterministic**: Standardized local execution. No AI reasoning.
- **Fast**: Runs locally using simple `subprocess` tools.
- **Extensible**: Designed to easily accommodate future workflow nodes.

## File Structure
```text
agents/orchestrator/
 ├── router.py             # Entrypoint, parses CLI args and dispatches to commands.
 ├── commands/             # Individual workflow logic.
 │    ├── review.py        # Runs linters, typechecks, etc.
 │    ├── validate_db.py   # Validates database schemas.
 │    ├── docs_check.py    # Ensures mandatory documentation is present.
 │    └── pre_release.py   # Composes multiple commands into a pre-release pipeline.
 └── utils/                # Shared utilities.
      ├── logger.py        # Standardized terminal logging.
      ├── shell.py         # Subprocess wrappers for executing shell commands.
      └── file_scan.py     # File reading and scanning utilities.
```

## Execution Flow
1. **Entrypoint**: You invoke the orchestrator via `python agents/orchestrator/router.py <command>`.
2. **Parsing & Routing**: `router.py` receives the command name, validates it against the `COMMANDS` registry, and routes it to the corresponding module in `commands/`.
3. **Execution**: The target command module (e.g., `review.py`) imports utilities from `utils/` to safely execute shell commands (`npm run typecheck`, etc.) or read files.
4. **Return & Exit**: The command module returns an integer exit code (0 for success, non-zero for failure). The router exits with this code, making the orchestrator suitable for CI/CD or Git hooks.

## Future Integrations
The orchestrator is designed to act as the primary local hub, leaving room for future systems:
- **Amon Agents (AA)**: Future planners, QA, or specialized agents can be invoked deterministically through a new command, allowing structured handoffs between the local execution shell and Amon.
- **Sentinel Board (SB)**: Release states, task statuses, or test failures can be broadcasted via JSON payloads or webhooks to SB after a local orchestrator run completes. Extension points are present in `router.py`.
