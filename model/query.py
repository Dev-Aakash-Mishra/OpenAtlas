import os
import logging
from model.build_graph import Node, load_nodes
from model.llm import chat_llm

logger = logging.getLogger(__name__)

GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "graph.json")

QUERY_SYSTEM_PROMPT = """You are OpenAtlas, an AI analyst that answers questions using a knowledge graph of real-world news events.

You will receive CONTEXT: a set of graph nodes, each with an ID, domain, content, and key elements.
You will also receive a USER QUESTION.

RULES:
- Answer the question using ONLY the provided context nodes.
- Cite your sources by referencing node IDs in square brackets, e.g. [6e068955].
- Use the first 8 characters of the node ID for citations.
- If multiple nodes support a claim, cite all of them.
- If the context doesn't contain enough information, say so honestly.
- Be concise but thorough. Use 2-4 paragraphs max.
- Structure your answer clearly with key facts first."""


def find_relevant_nodes(query: str, nodes: list[Node], top_k: int = 5) -> list[Node]:
    query_terms = set(query.lower().split())

    scored: list[tuple[float, Node]] = []
    for node in nodes:
        score = 0.0

        content_lower = node.content.lower()
        for term in query_terms:
            if term in content_lower:
                score += 2.0

        for element in node.key_elements:
            element_lower = element.lower()
            for term in query_terms:
                if term in element_lower or element_lower in query.lower():
                    score += 3.0

        query_lower = query.lower()
        for element in node.key_elements:
            if element.lower() in query_lower:
                score += 5.0

        connections = len(node.next) + len(node.prev)
        score += connections * 0.5

        if score > 0:
            scored.append((score, node))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [node for _, node in scored[:top_k]]


def get_connected_nodes(node_ids: list[str], all_nodes: list[Node], depth: int = 1) -> list[Node]:
    node_map: dict[str, Node] = {n.id: n for n in all_nodes}
    collected: set[str] = set(node_ids)

    frontier = set(node_ids)
    for _ in range(depth):
        next_frontier: set[str] = set()
        for nid in frontier:
            node = node_map.get(nid)
            if not node:
                continue
            for linked_id in node.next + node.prev:
                if linked_id not in collected:
                    collected.add(linked_id)
                    next_frontier.add(linked_id)
        frontier = next_frontier

    return [node_map[nid] for nid in collected if nid in node_map]


def build_context(nodes: list[Node]) -> str:
    parts: list[str] = []
    for node in nodes:
        parts.append(
            f"[NODE {node.id[:8]}] (ID: {node.id})\n"
            f"Domain: {node.domain}\n"
            f"Content: {node.content}\n"
            f"Key Elements: {', '.join(node.key_elements)}\n"
            f"Speculation: {node.speculation}"
            f"{f' (confidence: {node.confidence})' if node.confidence else ''}\n"
            f"Connections: {len(node.next)} outgoing, {len(node.prev)} incoming"
        )
    return "\n\n---\n\n".join(parts)


def get_node_by_id(node_id: str, graph_path: str = GRAPH_PATH) -> Node | None:
    nodes = load_nodes(graph_path)
    for node in nodes:
        if node.id == node_id or node.id.startswith(node_id):
            return node
    return None


def search_nodes(query: str, graph_path: str = GRAPH_PATH) -> list[Node]:
    nodes = load_nodes(graph_path)
    return find_relevant_nodes(query, nodes, top_k=10)


def query_graph(question: str, graph_path: str = GRAPH_PATH) -> dict:
    nodes = load_nodes(graph_path)
    relevant = find_relevant_nodes(question, nodes, top_k=5)
    
    if not relevant:
        return {
            "answer": "I couldn't find any relevant information in the knowledge graph for your question.",
            "cited_nodes": [],
            "context_nodes": [],
        }

    relevant_ids = [n.id for n in relevant]
    context_nodes = get_connected_nodes(relevant_ids, nodes, depth=1)
    context = build_context(context_nodes)

    prompt = (
        f"CONTEXT (Knowledge Graph Nodes):\n\n{context}\n\n"
        f"---\n\n"
        f"USER QUESTION: {question}\n\n"
        f"Answer the question using the context above. Cite node IDs in [brackets]."
    )

    answer = chat_llm(prompt, QUERY_SYSTEM_PROMPT)

    cited_ids: list[str] = []
    for node in context_nodes:
        short_id = node.id[:8]
        if short_id in answer:
            cited_ids.append(node.id)

    return {
        "answer": answer,
        "cited_nodes": cited_ids,
        "context_nodes": [n.model_dump(mode="json") for n in context_nodes],
    }
