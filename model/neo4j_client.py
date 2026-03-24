import os
import logging
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class Neo4jClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Neo4jClient, cls).__new__(cls)
            uri = os.getenv("NEO4J_URI")
            user = os.getenv("NEO4J_USER")
            password = os.getenv("NEO4J_PASSWORD")
            try:
                cls._instance.driver = GraphDatabase.driver(
                    uri, 
                    auth=(user, password),
                    connection_timeout=15.0,
                    connection_acquisition_timeout=30.0,
                    max_connection_lifetime=200,  # Prevent defunct connection errors on Aura
                    keep_alive=True
                )
                cls._instance.driver.verify_connectivity()
                logger.info("Successfully connected to Neo4j.")
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j: {e}")
                cls._instance.driver = None
                raise RuntimeError(f"Neo4j Connection Error: {e}")
        return cls._instance

    def close(self):
        if self.driver:
            self.driver.close()

    def execute_query(self, query, parameters=None):
        if not self.driver:
            raise RuntimeError("Neo4j driver not initialized. Check your credentials and connection.")
        with self.driver.session() as session:
            # Consume the result into a list while the session is open
            return list(session.run(query, parameters))

    def init_vector_index(self, dimension=None):
        """Create a vector index in Neo4j if it doesn't exist."""
        if dimension is None:
            # Default to 768 which is used by gemini-embedding-2-preview in model/llm.py
            dimension = 768
            
        logger.info(f"Initializing Neo4j Vector Index with dimension: {dimension}")
        query = f"""
        CREATE VECTOR INDEX node_embeddings IF NOT EXISTS
        FOR (e:Event) ON (e.embedding)
        OPTIONS {{
          indexConfig: {{
            `vector.dimensions`: {dimension},
            `vector.similarity_function`: 'cosine'
          }}
        }}
        """
        try:
            self.execute_query(query)
            logger.info("Neo4j Vector Index initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize vector index: {e}")

neo4j_client = Neo4jClient()
