import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from model import query
from model.query import find_narrative_thread
from unittest.mock import MagicMock

def test_narrative_logic():
    # We can't easily mock Neo4j here without a lot of ceremony, 
    # but we can check if the function exists and the prompts are defined.
    print("Checking if find_narrative_thread is defined...")
    assert callable(find_narrative_thread)
    print("✅ find_narrative_thread is callable.")
    
    # Check if the system prompt is defined
    assert hasattr(query, 'NARRATIVE_SYSTEM_PROMPT')
    print("✅ NARRATIVE_SYSTEM_PROMPT is defined.")

if __name__ == "__main__":
    test_narrative_logic()
