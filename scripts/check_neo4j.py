import os
import sys
import logging
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from model.neo4j_client import neo4j_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_db():
    logger.info("Checking Neo4j database status...")
    
    # Check node count
    res_nodes = neo4j_client.execute_query("MATCH (n:Event) RETURN count(n) as count")
    count = res_nodes.single()["count"]
    logger.info(f"Total nodes labeled ':Event': {count}")
    
    # Check relationship count
    res_rels = neo4j_client.execute_query("MATCH ()-[r:CONNECTED_TO]->() RETURN count(r) as count")
    rel_count = res_rels.single()["count"]
    logger.info(f"Total relationships labeled 'CONNECTED_TO': {rel_count}")
    
    # Sample node
    res_sample = neo4j_client.execute_query("MATCH (n:Event) RETURN n LIMIT 1")
    sample = res_sample.single()
    if sample:
        logger.info(f"Sample node found: {sample['n']['id']}")
    else:
        logger.warning("No sample node could be retrieved.")

if __name__ == "__main__":
    check_db()
