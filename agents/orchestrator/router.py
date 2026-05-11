#!/usr/bin/env python3
import sys
import argparse
from pathlib import Path
from typing import Dict, Callable

# Add orchestrator to Python path to enable clean imports
current_dir = Path(__file__).parent.resolve()
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from commands import review, validate_db, docs_check, pre_release
from utils.logger import logger

# -- FUTURE EXTENSION POINTS --
# def handle_amon_agents_integration(payload: dict):
#     """Integration point for future Amon Agents (AA) system."""
#     pass
#
# def sync_sentinel_board(state: str):
#     """Integration point for Sentinel Board (SB) synchronization."""
#     pass
# -----------------------------

COMMANDS: Dict[str, Callable[[], int]] = {
    "review": review.run,
    "validate-db": validate_db.run,
    "docs-check": docs_check.run,
    "pre-release": pre_release.run,
}

def main():
    parser = argparse.ArgumentParser(description="Liev Internal Dev Orchestrator")
    parser.add_argument("command", choices=list(COMMANDS.keys()), help="Command to execute")
    
    args = parser.parse_args()
    command_name = args.command
    
    logger.info(f"Routing command: {command_name}")
    
    # Execute the command
    handler = COMMANDS[command_name]
    try:
        exit_code = handler()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.warning("\nExecution interrupted by user.")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unexpected error executing {command_name}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
