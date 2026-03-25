import os
import sys
import logging

# Ensure we're in the right directory
sys.path.append(os.getcwd())

from backend.scheduler import fetch_and_ingest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestIngest")

if __name__ == "__main__":
    logger.info("Starting MANUALLY TRIGGERED ingestion test...")
    try:
        fetch_and_ingest()
        logger.info("✅ Manual ingestion test FINISHED successfully.")
    except Exception as e:
        logger.error(f"❌ Manual ingestion test FAILED: {e}")
        import traceback
        traceback.print_exc()
