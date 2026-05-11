from pathlib import Path
from typing import List, Optional

def find_files(directory: str, pattern: str) -> List[Path]:
    """Find files matching a glob pattern."""
    path = Path(directory)
    if not path.exists() or not path.is_dir():
        return []
    return list(path.rglob(pattern))

def read_file(filepath: Path) -> Optional[str]:
    """Read file contents securely."""
    try:
        return filepath.read_text(encoding='utf-8')
    except Exception:
        return None
