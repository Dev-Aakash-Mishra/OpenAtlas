import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from model import build_graph
from model.build_graph import Node

def check_sentiment():
    try:
        n = Node(content="Test content", domain="geopolitics", sentiment=0.5)
        print(f"Node created with sentiment: {n.sentiment}")
        assert n.sentiment == 0.5
        
        n2 = Node(content="Neutral content", domain="geopolitics")
        print(f"Node created with default sentiment: {n2.sentiment}")
        assert n2.sentiment == 0.0
        
        print("✅ Node model verification successful.")
    except Exception as e:
        print(f"❌ Node model verification failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_sentiment()
