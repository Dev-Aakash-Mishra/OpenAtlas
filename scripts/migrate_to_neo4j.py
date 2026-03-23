import os
import sys
import logging
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from model.neo4j_client import neo4j_client
from model.build_graph import load_nodes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "graph.json")

def migrate():
    logger.info("Starting migration from graph.json to Neo4j...")
    nodes = load_nodes(GRAPH_PATH)
    
    if not nodes:
        logger.warning("No nodes found in graph.json. Migration skipped.")
        return

    # 1. Initialize Vector Index (Gemini text-embedding-004 has 768 dimensions)
    neo4j_client.init_vector_index(dimension=768)

    # 2. Clear existing database for a clean start (OPTIONAL, but good for migrations)
    # logger.info("Clearing existing data in Neo4j...")
    # neo4j_client.execute_query("MATCH (n) DETACH DELETE n")

    # 3. Create Nodes
    logger.info(f"Creating {len(nodes)} nodes in Neo4j...")
    for n in nodes:
        query = """
        MERGE (e:Event {id: $id})
        SET e.content = $content,
            e.domain = $domain,
            e.key_elements = $key_elements,
            e.speculation = $speculation,
            e.confidence = $confidence,
            e.trust_score = $trust_score,
            e.bias_warning = $bias_warning,
            e.image_url = $image_url,
            e.lat = $lat,
            e.lng = $lng,
            e.source_url = $source_url,
            e.timestamp = datetime($timestamp),
            e.embedding = $embedding
        """
        # Convert datetime to ISO format for Neo4j
        params = n.model_dump(mode="json")
        neo4j_client.execute_query(query, params)

    # 4. Create Relationships
    logger.info("Creating relationships in Neo4j...")
    for n in nodes:
        if n.next:
            for target_id in n.next:
                query = """
                MATCH (a:Event {id: $source_id})
                MATCH (b:Event {id: $target_id})
                MERGE (a)-[:CONNECTED_TO]->(b)
                """
                neo4j_client.execute_query(query, {"source_id": n.id, "target_id": target_id})

    logger.info("✅ Migration to Neo4j completed successfully.")

if __name__ == "__main__":
    migrate()
