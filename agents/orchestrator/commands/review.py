from utils.logger import logger
from utils.shell import run_cmd

def run() -> int:
    logger.info("Running code review checks...")
    
    logger.info("Running Next.js lint...")
    code, stdout, stderr = run_cmd("npm run lint")
    if code != 0:
        logger.error(f"Linting failed:\n{stdout}\n{stderr}")
        return code
        
    logger.info("Running TypeScript typecheck...")
    code, stdout, stderr = run_cmd("npm run typecheck")
    if code != 0:
        logger.error(f"Typechecking failed:\n{stdout}\n{stderr}")
        return code

    logger.success("Review passed successfully.")
    return 0
