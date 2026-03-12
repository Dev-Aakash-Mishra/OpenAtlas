import os
import sys
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from model.query import query_graph, get_node_by_id, search_nodes
from model.build_graph import load_nodes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(ROOT_DIR, "..", "data", "graph.json")
FRONTEND_DIST = os.path.join(ROOT_DIR, "..", "frontend", "dist")

app = FastAPI(title="OpenAtlas API", version="1.0.0")

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

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    result = query_graph(req.question, GRAPH_PATH)
    return ChatResponse(**result)

@app.get("/api/nodes/{node_id}")
def get_node(node_id: str) -> dict:
    node = get_node_by_id(node_id, GRAPH_PATH)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    return node.model_dump(mode="json")

@app.get("/api/search")
def search(q: str = "") -> list[dict]:
    if not q.strip():
        return []
    nodes = search_nodes(q, GRAPH_PATH)
    return [n.model_dump(mode="json") for n in nodes]

@app.get("/api/graph")
def get_graph() -> list[dict]:
    nodes = load_nodes(GRAPH_PATH)
    return [n.model_dump(mode="json") for n in nodes]

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
    # 0.0.0.0 enables access from local network if needed
    uvicorn.run(app, host="0.0.0.0", port=8000)
