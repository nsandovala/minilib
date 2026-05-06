#!/usr/bin/env python3
import os
import sys
import subprocess
import logging
from datetime import datetime

AGENTS = {
    "scaffold": "agents/scaffold/run.py",
    "validate-db": "agents/validate-db/run.py",
    "review": "agents/review/run.py",
    "test-gen": "agents/test-gen/run.py",
    "release": "agents/release/run.py",
}


def setup_logging() -> logging.Logger:
    log_dir = os.path.join("agents", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.log")

    logger = logging.getLogger("orchestrator")
    logger.setLevel(logging.DEBUG)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    if not logger.handlers:
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    return logger


def route(command: str, args: list[str]) -> int:
    logger = setup_logging()
    logger.info(f"Routing command: {command} with args: {args}")

    if command not in AGENTS:
        logger.error(f"Unknown command: {command}")
        available = ", ".join(AGENTS.keys())
        print(f"Error: Unknown command '{command}'. Available commands: {available}", file=sys.stderr)
        return 1

    script_path = AGENTS[command]

    if not os.path.isfile(script_path):
        logger.error(f"Agent script not found: {script_path}")
        print(f"Error: Agent script not found: {script_path}", file=sys.stderr)
        return 1

    try:
        result = subprocess.run([sys.executable, script_path] + args, check=True)
        logger.info(f"Command '{command}' completed with exit code {result.returncode}")
        return result.returncode
    except subprocess.CalledProcessError as e:
        logger.error(f"Command '{command}' failed with exit code {e.returncode}")
        return e.returncode
    except Exception as e:
        logger.exception(f"Unexpected error running command '{command}'")
        return 1


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python agents/orchestrator/router.py <command> [args...]", file=sys.stderr)
        available = ", ".join(AGENTS.keys())
        print(f"Available commands: {available}", file=sys.stderr)
        return 1

    command = sys.argv[1]
    args = sys.argv[2:]
    return route(command, args)


if __name__ == "__main__":
    sys.exit(main())
