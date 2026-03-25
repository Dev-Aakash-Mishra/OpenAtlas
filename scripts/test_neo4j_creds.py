import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

def test_conn(uri, user, password):
    print(f"Testing: URI={uri}, USER={user}, PASSWORD={password[:5]}...")
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        print(f"SUCCESS for user: {user}")
        driver.close()
        return True
    except Exception as e:
        print(f"FAILED for user: {user}. Error: {e}")
        return False

def run_tests():
    load_dotenv()
    uri = os.getenv("NEO4J_URI")
    user_in_env = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    
    print(f"DEBUG: URI found: {uri is not None}")
    print(f"DEBUG: USER found: {user_in_env is not None}")
    
    if not uri or not password:
        print("CRITICAL: URI or PASSWORD missing from .env!")
        return

    uri = uri.strip('"')
    password = password.strip('"')
    user_in_env = (user_in_env or "neo4j").strip('"')
    
    # Try 'neo4j' and the one in .env
    test_conn(uri, "neo4j", password)
    if user_in_env != "neo4j":
        test_conn(uri, user_in_env, password)

if __name__ == "__main__":
    run_tests()
