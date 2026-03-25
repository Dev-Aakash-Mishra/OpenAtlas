import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.neo4j_client import neo4j_client
from model.llm import get_embedding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def recompute_embeddings():
    query = "MATCH (n:Event) WHERE n.embedding IS NULL RETURN n.id, n.content"
    try:
        results = neo4j_client.execute_query(query)
        print(f"Found {len(results)} nodes without embeddings.")
        
        for record in results:
            nid = record['n.id']
            content = record['n.content']
            
            logger.info(f"Generating embedding for node: {nid[:8]}")
            emb = get_embedding(content)
            
            if emb:
                update_query = "MATCH (n:Event {id: $id}) SET n.embedding = $emb"
                neo4j_client.execute_query(update_query, {"id": nid, "emb": emb})
            else:
                logger.warning(f"Failed to get embedding for node: {nid[:8]}")
                
        print("Recomputation complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    recompute_embeddings()
