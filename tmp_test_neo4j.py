import os
import logging
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

def test_conn():
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    print(f"Testing connection to {uri} with user {user}...")
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        print("✅ SUCCESS: Connected to Neo4j.")
        with driver.session() as session:
            count = session.run("MATCH (n:Event) RETURN count(n) as c").single()["c"]
            print(f"✅ Success: Found {count} nodes.")
        driver.close()
    except Exception as e:
        print(f"❌ FAILURE: {e}")

if __name__ == "__main__":
    test_conn()
