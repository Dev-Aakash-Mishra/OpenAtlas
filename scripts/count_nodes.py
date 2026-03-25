import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.neo4j_client import neo4j_client

query = "MATCH (n:Event) RETURN count(n) as count"
try:
    result = neo4j_client.execute_query(query)
    print(f"Total Nodes: {result[0]['count']}")
except Exception as e:
    print(f"Error: {e}")
