import os
import sys
import logging
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import time
import requests

# Ensure the root directory is in sys.path for internal module imports
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from model.query import query_graph, get_node_by_id, search_nodes, find_narrative_thread, predict_speculative_branches, materialize_ghost_node, deep_dive_node
from model.build_graph import Node
from model.neo4j_client import neo4j_client
from scheduler import start_background_worker, fetch_and_ingest, worker_status
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Neo4j Vector Index...")
    try:
        neo4j_client.init_vector_index()
    except Exception as e:
        logger.error(f"Failed to auto-init vector index: {e}")
        
    logger.info("Starting background feed worker...")
    # Increased interval to 5 minutes to avoid Gemini API Rate Limits (Error 429)
    start_background_worker(interval_seconds=300)
    yield
    logger.info("Shutting down background worker...")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(ROOT_DIR, "..", "data", "graph.json")
FRONTEND_DIST = os.path.join(ROOT_DIR, "..", "frontend", "dist")

app = FastAPI(title="OpenAtlas API", version="1.0.0", lifespan=lifespan)

# --- GLOBAL SYSTEM ROUTES ---
@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/api/status")
def get_system_status():
    return worker_status

@app.post("/api/deploy")
async def deploy_query(background_tasks: BackgroundTasks, region: str = "global"):
    """Manually trigger a fresh news ingestion cycle."""
    logger.info(f"Manual deployment triggered via API (POST) for region: {region}.")
    background_tasks.add_task(fetch_and_ingest, region)
    return {"message": f"Deployment initiated for {region}", "status": "processing"}

@app.get("/api/deploy")
def deploy_diag():
    return {"status": "available", "method": "GET"}

# --- BUSINESS LOGIC ROUTES ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str
    cited_nodes: list[str]
    context_nodes: list[dict]

class MaterializeRequest(BaseModel):
    source_id: str
    content: str
    domain: str = "Predictive"

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."}
    )

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        logger.info(f"Received chat request: {req.question[:50]}...")
        result = query_graph(req.question)
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"CRITICAL: Chat endpoint failed: {e}", exc_info=True)
        # We return a 500 but with a clear log so we can debug. 
        # The frontend will catch this and show a friendly message.
        raise HTTPException(
            status_code=500, 
            detail=f"OpenAtlas Intelligence is currently unavailable. (Code: {type(e).__name__})"
        )

@app.get("/api/nodes/{node_id}")
def get_node(node_id: str) -> dict:
    node = get_node_by_id(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    return node.model_dump(mode="json")

@app.get("/api/search")
def search(q: str = "") -> list[dict]:
    if not q.strip():
        return []
    nodes = search_nodes(q)
    return [n.model_dump(mode="json") for n in nodes]

@app.get("/api/narrative_thread/{node_id}")
def get_narrative_thread(node_id: str) -> dict:
    return find_narrative_thread(node_id)

@app.get("/api/predict_branch/{node_id}")
def get_predict_branch(node_id: str) -> list[dict]:
    return predict_speculative_branches(node_id)

@app.post("/api/materialize")
def post_materialize(req: MaterializeRequest) -> dict:
    return materialize_ghost_node(req.model_dump())

@app.get("/api/deep_dive/{node_id}")
def get_deep_dive(node_id: str) -> dict:
    return deep_dive_node(node_id)

@app.get("/api/graph")
def get_graph(region: str = "global") -> list[dict]:
    """Fetch latest 150 nodes and their relationships from Neo4j, filtered by region."""
    cypher = """
    MATCH (n:Event)
    WHERE (n.region = $region) OR ($region = 'global' AND n.region IS NULL)
    OPTIONAL MATCH (n)-[:CONNECTED_TO]->(m:Event)
    WITH n, collect(m.id) as next_ids
    ORDER BY n.timestamp DESC
    LIMIT 150
    RETURN n, next_ids
    """
    result = neo4j_client.execute_query(cypher, {"region": region})
    
    nodes_data = []
    if result:
        for record in result:
            data = dict(record['n'])
            if 'timestamp' in data:
                data['timestamp'] = str(data['timestamp'])
            
            # Neo4j property might be 'sentiment'
            data['sentiment'] = data.get('sentiment', 0.0)
            
            # Map Neo4j relationships to the 'next' and 'prev' fields for React Flow
            data['next'] = record['next_ids']
            data['prev'] = [] # Simplified: React Flow edges handle direction
            
            nodes_data.append(data)
            
    return nodes_data

if os.path.exists(FRONTEND_DIST):
    # Standard way to serve assets
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        
        # Check if it's a file in the root dist (like favicon.svg)
        p = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(p):
            return FileResponse(p)
            
        # Fallback to index.html for SPA
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def building():
        return {"message": "Frontend not found. Please run build script."}

if __name__ == "__main__":
    import uvicorn
    import traceback
    try:
        # 0.0.0.0 enables access from local network if needed
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except Exception as e:
        with open("startup_error.log", "w") as f:
            f.write(traceback.format_exc())
            f.write(f"\nError: {e}")
        sys.exit(1)
