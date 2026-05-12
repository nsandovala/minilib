from utils.logger import logger
from utils.shell import run_cmd


def run() -> int:
    logger.info("Running code review checks...")

    checks = [
        ("TypeScript typecheck", "npm run typecheck"),
        ("Production build", "npm run build"),
    ]

    for label, command in checks:
        logger.info(f"Running {label}...")
        code, stdout, stderr = run_cmd(command)

        if code != 0:
            logger.error(f"{label} failed:\n{stdout}\n{stderr}")
            return code

    logger.success("Review passed successfully.")
    return 0