from utils.logger import logger
from commands import review, validate_db, docs_check

def run() -> int:
    logger.info("Preparing pre-release checks...")
    
    steps = [
        ("Review", review.run),
        ("DB Validation", validate_db.run),
        ("Docs Check", docs_check.run)
    ]
    
    for name, step_func in steps:
        logger.info(f"--- Starting {name} ---")
        if step_func() != 0:
            logger.error(f"Pre-release failed at step: {name}")
            return 1
            
    logger.success("All pre-release checks passed successfully! Ready for release.")
    return 0
