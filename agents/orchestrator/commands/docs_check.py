from pathlib import Path
from utils.logger import logger

def run() -> int:
    logger.info("Running documentation checks...")
    
    required_docs = [
        "docs/ARCHITECTURE.md",
        "docs/DATABASE.md",
        "docs/SYNC_ENGINE.md",
        "docs/MVP_STATUS.md"
    ]
    
    missing_docs = []
    # Assumes run from project root or checks relative to project root
    project_root = Path(__file__).parent.parent.parent.parent.resolve()
    for doc in required_docs:
        if not (project_root / doc).exists():
            missing_docs.append(doc)
            
    if missing_docs:
        logger.error(f"Missing required documentation: {', '.join(missing_docs)}")
        return 1
        
    logger.success("Documentation checks passed.")
    return 0
