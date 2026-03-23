import os
import sys
import logging

# Ensure we can import from the root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.query import query_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_rag():
    question = "What are the latest developments in geopolitics?"
    print(f"\nTesting RAG with question: '{question}'")
    print("-" * 50)
    
    try:
        result = query_graph(question)
        print("\nANSWER:")
        print(result['answer'])
        print("\nCITED NODES:")
        for nid in result['cited_nodes']:
            print(f"- {nid}")
        print("\nCONTEXT NODES COUNT:", len(result['context_nodes']))
        
        if result['cited_nodes']:
            print("\n✅ RAG Verification Successful!")
        else:
            print("\n⚠️ Refine: No cited nodes found. This might be fine if the graph is empty or data is unrelated.")
            
    except Exception as e:
        print(f"\n❌ RAG Verification Failed: {e}")

if __name__ == "__main__":
    test_rag()
