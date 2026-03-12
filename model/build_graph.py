from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
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
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    speculation: bool = False
    confidence: Optional[float] = None

    def __init__(self, **data):
        super().__init__(**data)
        if not self.speculation:
            self.confidence = None

def save_nodes(nodes: list[Node], path="data/graph.json"):
    with open(path, "w") as f:
        json.dump([node.model_dump(mode="json") for node in nodes], f, indent=2)

def load_nodes(path="data/graph.json") -> list[Node]:
    with open(path, "r") as f:
        data = json.load(f)
    return [Node(**n) for n in data]
