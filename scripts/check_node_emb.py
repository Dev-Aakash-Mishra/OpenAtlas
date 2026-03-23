import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.neo4j_client import neo4j_client

query = "MATCH (n:Event) WHERE n.embedding IS NOT NULL RETURN n.embedding LIMIT 1"
try:
    result = neo4j_client.execute_query(query)
    if result:
        emb = result[0]['n.embedding']
        print(f"Embedding Dimension: {len(emb)}")
        print(f"First 5 values: {emb[:5]}")
    else:
        print("No nodes with embeddings found.")
except Exception as e:
    print(f"Error: {e}")
