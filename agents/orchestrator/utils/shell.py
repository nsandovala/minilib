import subprocess
from typing import Tuple, Optional
from .logger import logger

def run_cmd(command: str, cwd: Optional[str] = None, check: bool = False) -> Tuple[int, str, str]:
    """
    Executes a shell command.
    Returns (returncode, stdout, stderr)
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            text=True,
            capture_output=True,
            check=check
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {command}")
        return e.returncode, e.stdout.strip() if e.stdout else "", e.stderr.strip() if e.stderr else str(e)
    except Exception as e:
        logger.error(f"Execution error: {str(e)}")
        return 1, "", str(e)
