import os
import logging
import networkx as nx
from model.llm import chat_llm_json, chat_llm, get_embedding
from model.build_graph import Node, load_nodes, save_nodes
from model.neo4j_client import neo4j_client
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "graph.json")

SYSTEM_PROMPT = """You are a geopolitical and world-events analyst.
You will receive one or more raw news articles.
For EACH distinct news event, produce a JSON object with these fields:

- "content": str — a clean 2-3 sentence factual summary of the event.
- "key_elements": list[str] — lowercase entities and topics.
- "domain": str — one of: "geopolitics", "economics", "technology", "military", "environment", "society", "science", "culture", "sports", "health"
- "speculation": bool — true ONLY if the article is speculative/opinion.
- "confidence": float or null — only set (0.0-1.0) if speculation is true, null otherwise.
- "trust_score": int — 0-100 rating based on factual sourcing vs sensationalism.
- "bias_warning": bool — true if highly biased or emotionally charged.
- "image_url": str or null — pass the parsed Image URL exactly from the article if present.
- "source_url": str — pass the EXACT URL of the article.
- "lat": float or null — approximate latitude if a specific city/country is the primary target of the event.
- "lng": float or null — approximate longitude if a specific city/country is the primary target.
- "sentiment": float — a rating from -1.0 (negative/conflict) to 1.0 (positive/peaceful). Use 0.0 for neutral.

RULES:
- Return a JSON array, one object per distinct event. Merge duplicate events.
- SKIP articles that are not relevant or old.
- Do NOT include the fields: id, prev, next, reference, timestamp.
- Return ONLY valid JSON."""

GATEKEEPER_SYSTEM_PROMPT = """You are a deduplication engine.
Review the EXISTING EVENTS and the NEW ARTICLE below.
If the exact core event in the NEW ARTICLE is already described by one of the EXISTING EVENTS, output 'YES'.
Otherwise, output 'NO'. 
Output nothing else."""

def is_article_duplicate(article_url: str, article_text: str, existing_nodes: list[Node]) -> bool:
    if not existing_nodes:
        return False
        
    # 1. Quick URL Check (all nodes)
    if article_url:
        for ex in existing_nodes:
            if ex.source_url == article_url:
                return True

    # 2. Semantic Analysis (last 50 nodes for performance/token reasons)
    # This sliding window catches recent re-publications of the same event.
    recent = existing_nodes[-50:]
    recent_text = "\n".join([f"- {n.content}" for n in recent])
    
    prompt = f"EXISTING EVENTS:\n{recent_text}\n\nNEW ARTICLE:\n{article_text[:1200]}"
    try:
        ans = chat_llm(prompt, GATEKEEPER_SYSTEM_PROMPT).strip().upper()
        return 'YES' in ans
    except Exception as e:
        logger.error("Gatekeeper LLM failed: %s", e)
        return False

def _parse_cache_file(cache_path: str) -> list[dict]:
    with open(cache_path, "r", encoding="utf-8") as f:
        raw = f.read()

    blocks = raw.split("=" * 80)
    articles: list[dict] = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.split("\n", 2)
        if len(lines) < 2:
            continue

        header = lines[0].strip()
        body_lines = lines[1:]
        body = "\n".join(body_lines).strip()
        
        # Extract Image URL if present in body
        image_url = None
        clean_body_lines = []
        for bline in body_lines:
            if bline.startswith("IMAGE_URL:"):
                extracted = bline.replace("IMAGE_URL:", "").strip()
                if extracted:
                    image_url = extracted
            else:
                clean_body_lines.append(bline)
        body = "\n".join(clean_body_lines).strip()

        parts = header.split(", ", 2)
        if len(parts) < 3:
            continue

        date_str = parts[0].strip()
        url = parts[1].strip()
        title = parts[2].strip()

        if url in ("None", "") or not body or len(body) < 50:
            continue

        articles.append({
            "date": date_str,
            "url": url,
            "title": title,
            "image_url": image_url,
            "body": body[:1500],
        })

    return articles


def create_nodes(cache_path: str) -> list[Node]:
    os.makedirs(os.path.dirname(GRAPH_PATH), exist_ok=True)

    articles = _parse_cache_file(cache_path)
    logger.info("Parsed %d articles from %s", len(articles), cache_path)

    existing_nodes: list[Node] = []
    if os.path.exists(GRAPH_PATH):
        try:
            existing_nodes = load_nodes(GRAPH_PATH)
            logger.info("Loaded %d existing nodes", len(existing_nodes))
        except Exception:
            existing_nodes = []

    valid_articles = []
    for art in articles:
        if not is_article_duplicate(art.get('url'), art['body'][:1000], existing_nodes):
            valid_articles.append(art)
        else:
            logger.info("🛑 Dropped redundant/duplicate article: %s", art['title'])
            
    if not valid_articles:
        logger.info("All new articles were duplicates. Skipping extraction.")
        return existing_nodes

    prompt_parts: list[str] = []
    for idx, art in enumerate(valid_articles, 1):
        img_str = f"Image: {art['image_url']}\n" if art.get("image_url") else ""
        prompt_parts.append(
            f"--- ARTICLE {idx} ---\n"
            f"Title: {art['title']}\n"
            f"Date: {art['date']}\n"
            f"URL: {art['url']}\n"
            f"{img_str}"
            f"{art['body']}\n"
        )

    user_prompt = "\n".join(prompt_parts)
    logger.info("Sending %d articles to LLM in 1 call (~%d chars)",
                len(valid_articles), len(user_prompt))

    all_new_nodes: list[Node] = []

    try:
        result = chat_llm_json(user_prompt, SYSTEM_PROMPT)
        if isinstance(result, dict):
            result = [result]

        for item in result:
            all_new_nodes.append(Node(
                content=item["content"],
                key_elements=item.get("key_elements", []),
                domain=item.get("domain", "geopolitics"),
                speculation=item.get("speculation", False),
                confidence=item.get("confidence"),
                trust_score=item.get("trust_score", 50),
                bias_warning=item.get("bias_warning", False),
                image_url=item.get("image_url"),
                lat=item.get("lat"),
                lng=item.get("lng"),
                reference=cache_path,
            ))

        # Generate embeddings for the new nodes and save to Neo4j
        for n in all_new_nodes:
            logger.info(f"Generating embedding for node: {n.id[:8]}")
            n.embedding = get_embedding(n.content)
            
            logger.info(f"Saving node to Neo4j: {n.id[:8]}")
            query = """
            MERGE (e:Event {id: $id})
            SET e.content = $content,
                e.domain = $domain,
                e.key_elements = $key_elements,
                e.speculation = $speculation,
                e.confidence = $confidence,
                e.trust_score = $trust_score,
                e.bias_warning = $bias_warning,
                e.image_url = $image_url,
                e.lat = $lat,
                e.lng = $lng,
                e.source_url = $source_url,
                e.sentiment = $sentiment,
                e.timestamp = datetime($timestamp),
                e.embedding = $embedding
            """
            neo4j_client.execute_query(query, n.model_dump(mode="json"))
            
        _link_nodes(existing_nodes + all_new_nodes)
        
        logger.info("✅ All nodes persisted and linked in Neo4j.")
        logger.info("✅ LLM returned %d nodes and generated embeddings", len(all_new_nodes))

    except Exception as e:
        logger.error("❌ LLM call failed: %s", e)

    # Deduplicate new nodes against existing nodes based on content similarity and URLs
    # This deduplication logic is now primarily for preventing redundant processing/linking
    # if the LLM generated events that are very similar to each other or existing ones.
    # The Neo4j MERGE operation handles uniqueness by ID, but this step helps refine the set
    # of nodes that will be considered for further processing or local graph representation.
    unique_new_nodes = []
    for new_n in all_new_nodes:
        is_dup = False
        new_words = set(new_n.content.lower().split())
        new_keys = set(k.lower() for k in new_n.key_elements)
        
        for ex in existing_nodes + unique_new_nodes: # Compare against existing and already unique new nodes
            # 1. Strict URL check
            if new_n.source_url and new_n.source_url == ex.source_url:
                is_dup = True
                break
                
            # 2. Semantic overlap (Jaccard > 45%)
            ex_words = set(ex.content.lower().split())
            if len(new_words) > 0:
                overlap = len(new_words & ex_words) / len(new_words)
                if overlap > 0.45:  # 45% overlap catches paraphrased clones
                    is_dup = True
                    break
                    
            # 3. Key element overlap (3 shared keys + 30% word overlap)
            ex_keys = set(k.lower() for k in ex.key_elements)
            if len(new_keys) > 0 and len(ex_keys) > 0:
                if len(new_keys & ex_keys) >= 3 and len(new_words & ex_words) / max(len(new_words), 1) > 0.3:
                    is_dup = True
                    break

        if not is_dup:
            unique_new_nodes.append(new_n)
        else:
            logger.info("Dropped duplicate node: %s", new_n.content[:50])

    _link_nodes(existing_nodes + unique_new_nodes)

    all_nodes = existing_nodes + unique_new_nodes
    save_nodes(all_nodes, GRAPH_PATH)
    logger.info("Saved %d total nodes (%d new) to %s",
                len(all_nodes), len(unique_new_nodes), GRAPH_PATH)

    return all_nodes


def _link_nodes(nodes: list[Node]) -> None:
    # Pre-calculate numpy arrays for speed
    vecs = []
    for n in nodes:
        if n.embedding:
            vecs.append(np.array(n.embedding))
        else:
            vecs.append(None)

    logger.info("Linking %d nodes in Neo4j using Hybrid (Semantic + Keyword) logic...", len(nodes))
    for i, node_a in enumerate(nodes):
        v1 = vecs[i]
        for j, node_b in enumerate(nodes):
            if i >= j:
                continue
            
            v2 = vecs[j]
            
            # 1. Keyword Overlap
            shared_keys = set(node_a.key_elements) & set(node_b.key_elements)
            
            # 2. Semantic Similarity
            similarity = 0.0
            if v1 is not None and v2 is not None:
                similarity = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            
            # HYBRID RULE
            is_linked = (len(shared_keys) >= 3) or \
                        (similarity > 0.82) or \
                        (len(shared_keys) >= 2 and similarity > 0.7)

            if is_linked:
                # Direct Neo4j relationship creation
                query = """
                MATCH (a:Event {id: $source_id})
                MATCH (b:Event {id: $target_id})
                MERGE (a)-[:CONNECTED_TO]->(b)
                """
                neo4j_client.execute_query(query, {"source_id": node_a.id, "target_id": node_b.id})


def retrieve_graph(graph_path: str = GRAPH_PATH) -> nx.DiGraph:
    nodes = load_nodes(graph_path)
    G = nx.DiGraph()

    for node in nodes:
        G.add_node(node.id, **node.model_dump(mode="json"))

    for node in nodes:
        for child_id in node.next:
            G.add_edge(node.id, child_id)

    logger.info("Graph loaded: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges())
    return G


if __name__ == "__main__":
    import glob

    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model", ".cache")
    cache_files = sorted(glob.glob(os.path.join(cache_dir, "*.txt")))

    if not cache_files:
        logger.error("No cache files found in %s", cache_dir)
    else:
        latest = cache_files[-1]
        logger.info("Using cache: %s", latest)

        nodes = create_nodes(latest)
        print(f"\n{'='*60}")
        print(f"Created {len(nodes)} nodes")
        print(f"{'='*60}")

        for n in nodes[:5]:
            print(f"\n[{n.domain}] {n.content[:100]}...")
            print(f"  keys: {n.key_elements}")
            print(f"  links: {len(n.next)} outgoing, {len(n.prev)} incoming")

        G = retrieve_graph()
        print(f"\nGraph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
