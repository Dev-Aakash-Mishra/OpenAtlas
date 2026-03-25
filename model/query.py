import os
import logging
from model.build_graph import Node
from model.llm import chat_llm, get_embedding
from model.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

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

def find_relevant_nodes(query: str, top_k: int = 8) -> list[Node]:
    """Find relevant nodes using Neo4j Vector Search index."""
    query_vec = get_embedding(query)
    if not query_vec:
        logger.warning("Failed to get embedding for query: %s", query)
        return []

    cypher = """
    CALL db.index.vector.queryNodes('node_embeddings', $top_k, $query_embedding)
    YIELD node AS n, score
    RETURN n, score
    """
    
    try:
        results = neo4j_client.execute_query(cypher, {
            "top_k": top_k,
            "query_embedding": query_vec
        })
        
        nodes = []
        if results:
            for record in results:
                n_data = dict(record['n'])
                if 'timestamp' in n_data:
                    n_data['timestamp'] = str(n_data['timestamp'])
                nodes.append(Node(**n_data))
        return nodes
    except Exception as e:
        logger.error(f"Neo4j Vector Search failed: {e}")
        return []

def search_nodes(q: str) -> list[Node]:
    """Search nodes using keywords in Neo4j."""
    cypher = """
    MATCH (n:Event)
    WHERE n.content CONTAINS $q OR any(k IN n.key_elements WHERE k CONTAINS $q)
    RETURN n
    LIMIT 50
    """
    result = neo4j_client.execute_query(cypher, {"q": q})
    nodes = []
    if result:
        for record in result:
            n_data = dict(record['n'])
            if 'timestamp' in n_data:
                n_data['timestamp'] = str(n_data['timestamp'])
            nodes.append(Node(**n_data))
    return nodes

def get_node_by_id(node_id: str) -> Node | None:
    """Fetch a single node by ID from Neo4j."""
    cypher = "MATCH (n:Event {id: $id}) RETURN n"
    result = neo4j_client.execute_query(cypher, {"id": node_id})
    if result:
        record = result[0]
        n_data = dict(record['n'])
        if 'timestamp' in n_data:
            n_data['timestamp'] = str(n_data['timestamp'])
        return Node(**n_data)
    return None

def query_graph(question: str) -> dict:
    """End-to-end RAG query using Neo4j as context provider."""
    # 1. Find relevant nodes via Vector Search
    relevant_nodes = find_relevant_nodes(question, top_k=8)
    if not relevant_nodes:
        return {
            "answer": "I couldn't find any relevant events in the global ontology to answer your question.",
            "cited_nodes": [],
            "context_nodes": []
        }

    # 2. Build context string
    context_parts = []
    for n in relevant_nodes:
        context_parts.append(f"[{n.id[:8]}] ({n.domain}): {n.content}")
    
    context_text = "\n\n".join(context_parts)
    
    # 3. Prompt LLM
    prompt = f"""Use the following event context to answer: {question}
    
    Context:
    {context_text}
    
    Rules:
    - Cite source IDs in brackets (e.g. [8fc3a2]) when mentioning facts.
    - Be objective and analytical."""

    try:
        answer = chat_llm(prompt, QUERY_SYSTEM_PROMPT)
    except Exception as e:
        logger.error(f"LLM Call failed: {e}")
        answer = f"I encountered an error while processing your request. (Error: {e})"

    cited_ids = []
    for n in relevant_nodes:
        if n.id[:8] in answer:
            cited_ids.append(n.id)

    return {
        "answer": answer,
        "cited_nodes": cited_ids,
        "context_nodes": [n.model_dump(mode="json") for n in relevant_nodes]
    }

NARRATIVE_SYSTEM_PROMPT = """You are a Storytelling Engine.
Given a start event and several potential paths of connected events, pick the ONE path that represents the most logical, causal, or interesting narrative thread.

Rules:
- A path is a list of node IDs.
- Return a JSON object with:
  - "path": list of the full node IDs in order.
  - "explanation": a concise (1-2 sentence) explanation of the causal link.
- Only return valid JSON."""

def find_narrative_thread(node_id: str) -> dict:
    """Find a causal narrative thread starting from a node."""
    # Find paths up to length 4 (3 hops)
    cypher = """
    MATCH p = (n:Event {id: $id})-[:CONNECTED_TO*1..3]->(m:Event)
    RETURN [node in nodes(p) | {id: node.id, content: node.content}] as path_data
    LIMIT 10
    """
    results = neo4j_client.execute_query(cypher, {"id": node_id})
    
    if not results:
        return {"path": [node_id], "explanation": "No downstream connections found to form a narrative thread."}

    # Format paths for the LLM
    paths_text = []
    for i, record in enumerate(results):
        path_str = " -> ".join([f"[{step['id'][:8]}] {step['content'][:100]}..." for step in record['path_data']])
        paths_text.append(f"Path {i+1}: {path_str}")

    prompt = f"Available Paths:\n" + "\n".join(paths_text) + "\n\nSelect the best narrative path starting from the first node."
    
    try:
        import json
        raw_result = chat_llm(prompt, NARRATIVE_SYSTEM_PROMPT)
        # Basic JSON extraction
        if "```json" in raw_result:
            raw_result = raw_result.split("```json")[1].split("```")[0]
        
        data = json.loads(raw_result.strip())
        if not isinstance(data, dict) or "path" not in data or not isinstance(data["path"], list):
             raise ValueError("Malformed LLM response: missing path list")
        return data
    except Exception as e:
        logger.error(f"Narrative LLM failed or malformed: {e}")
        # Fallback to the first path
        first_path = [step['id'] for step in results[0]['path_data']]
        return {"path": first_path, "explanation": "Automatically generated causal thread."}

GHOST_SYSTEM_PROMPT = """You are a Predictive Analysis Engine.
Given a current event, suggest 2-3 logical future consequences or "next steps".
For each prediction, provide:
- "content": A concise description of the potential consequence.
- "domain": The likely domain (World, Tech, Finance, etc.).
- "probability": A decimal between 0.0 and 1.0.

Return a JSON array of objects."""

def predict_speculative_branches(node_id: str) -> list[dict]:
    """Predict potential future consequences of an event."""
    node = get_node_by_id(node_id)
    if not node:
        return []

    prompt = f"Current Event: {node.content}\n\nPredict 2-3 logical future consequences."
    
    try:
        import json
        import uuid
        raw_result = chat_llm(prompt, GHOST_SYSTEM_PROMPT)
        if "```json" in raw_result:
            raw_result = raw_result.split("```json")[1].split("```")[0]
        
        predictions = json.loads(raw_result.strip())
        ghost_nodes = []
        for pred in predictions:
            g_id = f"ghost_{uuid.uuid4().hex[:8]}"
            ghost_nodes.append({
                "id": g_id,
                "content": pred["content"],
                "domain": pred.get("domain", "Predictive"),
                "probability": pred.get("probability", 0.5),
                "isGhost": True,
                "source_id": node_id,
                "timestamp": node.timestamp # Close to source for layout
            })
        return ghost_nodes
    except Exception as e:
        logger.error(f"Ghost prediction failed: {e}")
        return []

def materialize_ghost_node(data: dict) -> dict:
    """Transform a ghost node into a real persistent node in Neo4j."""
    source_id = data.get("source_id")
    content = data.get("content")
    domain = data.get("domain", "Predictive")
    
    import uuid
    from datetime import datetime
    new_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    query = """
    MATCH (s:Event {id: $source_id})
    CREATE (n:Event {
        id: $new_id,
        content: $content,
        domain: $domain,
        timestamp: $timestamp,
        confidence: 0.7,
        is_speculative: true
    })
    CREATE (s)-[:PREDICTS]->(n)
    RETURN n.id as id
    """
    
    try:
        with neo4j_client.driver.session() as session:
            result = session.run(query, {
                "source_id": source_id,
                "new_id": new_id,
                "content": content,
                "domain": domain,
                "timestamp": now
            })
            record = result.single()
            if record:
                return {"status": "success", "id": record["id"]}
    except Exception as e:
        logger.error(f"Materialization failed: {e}")
        return {"status": "error", "message": str(e)}
    
    return {"status": "error", "message": "Node could not be created"}
def deep_dive_node(node_id: str) -> dict:
    """Generate a detailed 2-3 paragraph analysis of a node."""
    node = get_node_by_id(node_id)
    if not node:
        return {"status": "error", "message": "Node not found"}

    system_prompt = "You are a Senior Political and Economic Analyst. Provide a 2-3 paragraph deep-dive analysis of the given event. Focus on long-term implications and historical context."
    prompt = f"Event: {node.content}\nDomain: {node.domain}\nKey Elements: {', '.join(node.key_elements)}\n\nProvide a detailed deep-dive analysis."
    
    try:
        analysis = chat_llm(prompt, system_prompt)
        return {"status": "success", "analysis": analysis}
    except Exception as e:
        logger.error(f"Deep dive failed: {e}")
        return {"status": "error", "message": str(e)}

def get_narrative_evolution(query: str, limit: int = 30) -> list[dict]:
    """Find nodes related to a topic and return them ordered by time."""
    # 1. Semantic search to find the "core" of the narrative
    query_vec = get_embedding(query)
    if not query_vec:
        # Fallback to keyword search
        return search_nodes(query)

    cypher = """
    CALL db.index.vector.queryNodes('node_embeddings', $limit, $query_embedding)
    YIELD node AS n, score
    WHERE score > 0.6
    RETURN n
    ORDER BY n.timestamp ASC
    """
    
    try:
        results = neo4j_client.execute_query(cypher, {
            "limit": limit,
            "query_embedding": query_vec
        })
        
        nodes = []
        if results:
            for record in results:
                n_data = dict(record['n'])
                if 'timestamp' in n_data:
                    n_data['timestamp'] = str(n_data['timestamp'])
                # Ensure sentiment exists
                n_data['sentiment'] = n_data.get('sentiment', 0.0)
                nodes.append(n_data)
        return nodes
    except Exception as e:
        logger.error(f"Narrative Evolution query failed: {e}")
        return []
