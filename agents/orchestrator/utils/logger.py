import sys

class Logger:
    @staticmethod
    def info(message: str) -> None:
        print(f"[INFO] {message}")
        
    @staticmethod
    def success(message: str) -> None:
        print(f"[SUCCESS] {message}")
        
    @staticmethod
    def warning(message: str) -> None:
        print(f"[WARN] {message}")
        
    @staticmethod
    def error(message: str) -> None:
        print(f"[ERROR] {message}", file=sys.stderr)

logger = Logger()
