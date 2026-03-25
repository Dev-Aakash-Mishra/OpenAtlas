from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import json

class Node(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prev: List[str] = []
    next: List[str] = []
    reference: str = None
    content: str
    key_elements: List[str] = []
    domain: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    speculation: bool = False
    confidence: Optional[float] = None
    trust_score: int = 50
    bias_warning: bool = False
    image_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    embedding: Optional[List[float]] = None
    source_url: Optional[str] = None
    sentiment: Optional[float] = 0.0
    region: str = "global"
    # Indian Regional Metadata
    state: Optional[str] = None
    district: Optional[str] = None
    source_language: Optional[str] = "English"  # e.g., "Hindi", "Tamil", "English"
    publisher: Optional[str] = None  # e.g., "NDTV", "Amar Ujala"

    def __init__(self, **data):
        super().__init__(**data)
        if not self.speculation:
            self.confidence = None

def save_nodes(nodes: list[Node], path="data/graph.json"):
    import os
    temp_path = path + ".tmp"
    with open(temp_path, "w") as f:
        json.dump([node.model_dump(mode="json") for node in nodes], f, indent=2)
    os.replace(temp_path, path)

def load_nodes(path="data/graph.json") -> list[Node]:
    try:
        with open(path, "r") as f:
            data = json.load(f)
        return [Node(**n) for n in data]
    except Exception:
        return []
