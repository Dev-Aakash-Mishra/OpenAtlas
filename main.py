import os
import time  # ✅ FIX 6: moved to top of file
import logging
import networkx as nx
from model.llm import chat_llm_json, chat_llm, get_embedding, get_embeddings_batch
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

- "content": str — a clean 3-4 sentence factual summary of the event.
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
- Return a JSON array, one object per distinct event.
- EXTREMELY IMPORTANT: If multiple articles provide information on the SAME event, merge them into ONE object with the most comprehensive content.
- SKIP articles that are not relevant or old.
- Do NOT include the fields: id, prev, next, reference, timestamp.
- Return ONLY valid JSON."""


def get_tokens(text: str) -> set[str]:
    tokens = "".join(c if c.isalnum() or c.isspace() else " " for c in text.lower()).split()
    return {t for t in tokens if len(t) > 2}


def is_article_duplicate(article_url: str, article_text: str, article_title: str, existing_nodes: list[Node], region: str = "global") -> bool:
    if not existing_nodes:
        return False

    # Filter existing nodes to ONLY check for duplicates in the SAME region
    # This allows similar stories to exist in different regional views if desired
    regional_nodes = [n for n in existing_nodes if n.region == region]
    if not regional_nodes:
        return False

    # 1. Quick URL Check
    if article_url:
        for ex in regional_nodes:
            if ex.source_url == article_url:
                return True

    # ✅ FIX 5: Compare title tokens against existing node title/first-sentence
    art_tokens = get_tokens(article_title)
    max_sim = 0
    for ex in regional_nodes:
        # Use the first sentence of content as a proxy for the headline
        ex_headline = ex.content.split(".")[0] if ex.content else ""
        ex_tokens = get_tokens(ex_headline)
        if not art_tokens or not ex_tokens:
            continue
        intersection = len(art_tokens & ex_tokens)
        union = len(art_tokens | ex_tokens)
        sim = intersection / union if union > 0 else 0
        max_sim = max(max_sim, sim)

    if max_sim > 0.35:
        return True

    return False


def cluster_articles(articles: list[dict]) -> list[dict]:
    """Strengthened deduplication within the current batch based on fuzzy title similarity."""
    if not articles:
        return []

    unique_articles = []
    for art in articles:
        art_tokens = get_tokens(art['title'])
        is_dup = False

        for ua in unique_articles:
            ua_tokens = get_tokens(ua['title'])
            if not art_tokens or not ua_tokens:
                continue
            intersection = len(art_tokens & ua_tokens)
            union = len(art_tokens | ua_tokens)
            similarity = intersection / union if union > 0 else 0
            if similarity > 0.65:
                is_dup = True
                if len(art.get('body', '')) > len(ua.get('body', '')):
                    ua.update(art)
                break

        if not is_dup:
            unique_articles.append(art)

    return unique_articles


def _parse_cache_file(cache_path: str) -> list[dict]:
    with open(cache_path, "r", encoding="utf-8") as f:
        raw = f.read()

    blocks = raw.split("=" * 80)
    articles: list[dict] = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.split("\n")
        art = {"title": "", "url": "", "date": "", "body": "", "image_url": None}
        current_section = None
        body_lines = []

        for line in lines:
            if line.startswith("TITLE:"):
                art["title"] = line.replace("TITLE:", "").strip()
            elif line.startswith("LINK:"):
                art["url"] = line.replace("LINK:", "").strip()
            elif line.startswith("DATE:"):
                art["date"] = line.replace("DATE:", "").strip()
            elif line.startswith("IMAGE_URL:"):
                art["image_url"] = line.replace("IMAGE_URL:", "").strip()
            elif line.startswith("BODY:"):
                current_section = "BODY"
            elif current_section == "BODY":
                body_lines.append(line)

        art["body"] = "\n".join(body_lines).strip()

        if art["url"] in ("None", "") or not art["body"] or len(art["body"]) < 10:
            continue

        articles.append({
            "date": art["date"],
            "url": art["url"],
            "title": art["title"],
            "image_url": art["image_url"],
            "body": art["body"][:1500],
        })

    return articles


def _batch_save_to_neo4j(nodes: list[Node]) -> None:
    """✅ FIX 9: Batch write all nodes in a single Neo4j round-trip using UNWIND."""
    if not nodes:
        return

    records = [n.model_dump(mode="json") for n in nodes]
    query = """
    UNWIND $records AS r
    MERGE (e:Event {id: r.id})
    SET e.id           = r.id,
        e.content      = r.content,
        e.domain       = r.domain,
        e.key_elements = r.key_elements,
        e.speculation  = r.speculation,
        e.confidence   = r.confidence,
        e.trust_score  = r.trust_score,
        e.bias_warning = r.bias_warning,
        e.image_url    = r.image_url,
        e.lat          = r.lat,
        e.lng          = r.lng,
        e.source_url   = r.source_url,
        e.sentiment    = r.sentiment,
        e.region       = r.region,
        e.timestamp    = datetime(r.timestamp),
        e.embedding    = r.embedding
    """
    neo4j_client.execute_query(query, {"records": records})
    logger.info("✅ Batch saved %d nodes to Neo4j.", len(nodes))


def create_nodes(cache_path: str, region: str = "global") -> list[Node]:
    os.makedirs(os.path.dirname(GRAPH_PATH), exist_ok=True)

    articles = _parse_cache_file(cache_path)
    logger.info("Parsed %d articles from %s", len(articles), cache_path)

    # 1. Batch-internal deduplication
    articles = cluster_articles(articles)
    logger.info("After internal clustering: %d articles", len(articles))

    existing_nodes: list[Node] = []
    if os.path.exists(GRAPH_PATH):
        try:
            existing_nodes = load_nodes(GRAPH_PATH)
            logger.info("Loaded %d existing nodes", len(existing_nodes))
        except Exception:
            existing_nodes = []

    valid_articles = []
    for art in articles:
        if is_article_duplicate(art.get('url'), art['body'][:1200], art['title'], existing_nodes, region=region):
            logger.info("🛑 Dropped redundant/duplicate article: %s", art['title'])
        else:
            valid_articles.append(art)

    if not valid_articles:
        logger.info("All new articles were duplicates. Skipping extraction.")
        return existing_nodes

    all_new_nodes: list[Node] = []

    # Process in chunks to avoid LLM output token limits
    chunk_size = 10
    for i in range(0, len(valid_articles), chunk_size):
        chunk = valid_articles[i:i + chunk_size]
        logger.info(f"Processing extraction chunk {i // chunk_size + 1}: {len(chunk)} articles")

        prompt_parts: list[str] = []
        for idx, art in enumerate(chunk, 1):
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
                    source_url=item.get("source_url"),
                    lat=item.get("lat"),
                    lng=item.get("lng"),
                    sentiment=item.get("sentiment", 0.0),  # ✅ FIX 4: sentiment now passed
                    reference=cache_path,
                    region=region,
                ))

            time.sleep(2)  # ✅ FIX 6: import already at top

        except Exception as e:
            logger.error(f"❌ LLM chunk extraction failed: {e}")
            continue

    if not all_new_nodes:
        logger.warning("No new nodes extracted from LLM chunks.")
        return existing_nodes

    # ✅ FIX 3: Deduplicate BEFORE generating embeddings and saving to Neo4j
    logger.info("Deduplicating %d LLM-extracted nodes before saving...", len(all_new_nodes))
    unique_new_nodes: list[Node] = []
    for new_n in all_new_nodes:
        is_dup = False
        new_words = set(new_n.content.lower().split())
        new_keys = set(k.lower() for k in new_n.key_elements)

        for ex in existing_nodes + unique_new_nodes:
            if new_n.source_url and new_n.source_url == ex.source_url:
                is_dup = True
                break

            ex_words = set(ex.content.lower().split())
            if len(new_words) > 0:
                overlap = len(new_words & ex_words) / len(new_words)
                if overlap > 0.45:
                    is_dup = True
                    break

            ex_keys = set(k.lower() for k in ex.key_elements)
            if len(new_keys) > 0 and len(ex_keys) > 0:
                if len(new_keys & ex_keys) >= 3 and len(new_words & ex_words) / max(len(new_words), 1) > 0.3:
                    is_dup = True
                    break

        if not is_dup:
            unique_new_nodes.append(new_n)
        else:
            logger.info("Dropped duplicate node: %s", new_n.content[:50])

    if not unique_new_nodes:
        logger.warning("All extracted nodes were duplicates of existing ones.")
        return existing_nodes

    # 4. Batch generate embeddings for unique new nodes only
    logger.info("Generating batch embeddings for %d unique new nodes...", len(unique_new_nodes))
    contents = [n.content for n in unique_new_nodes]

    # ✅ FIX 13: Safe embedding with per-item fallback if batch partially fails
    try:
        embeddings = get_embeddings_batch(contents)
        if len(embeddings) != len(unique_new_nodes):
            raise ValueError(f"Embedding count mismatch: got {len(embeddings)}, expected {len(unique_new_nodes)}")
    except Exception as e:
        logger.error("Batch embedding failed (%s). Falling back to per-item embedding.", e)
        embeddings = []
        for content in contents:
            try:
                embeddings.append(get_embedding(content))
            except Exception as inner_e:
                logger.warning("Per-item embedding failed, using zero vector: %s", inner_e)
                embeddings.append([0.0] * 768)

    for n, emb in zip(unique_new_nodes, embeddings):
        n.embedding = emb

    # ✅ FIX 9: Single batched Neo4j write instead of N round-trips
    _batch_save_to_neo4j(unique_new_nodes)

    # ✅ FIX 8: Small delay to let Neo4j index the new vectors before vector search
    logger.info("Waiting for Neo4j vector index to settle...")
    time.sleep(3)

    # ✅ FIX 10: Only link NEW nodes — no need to re-link all existing nodes
    _link_new_nodes(unique_new_nodes)

    # ✅ FIX 2: Removed undefined _link_nodes() call that would have caused NameError

    all_nodes = existing_nodes + unique_new_nodes
    save_nodes(all_nodes, GRAPH_PATH)
    logger.info("Saved %d total nodes (%d new) to %s",
                len(all_nodes), len(unique_new_nodes), GRAPH_PATH)

    return all_nodes


def _link_new_nodes(new_nodes: list[Node]) -> None:
    """For each new node, find its top-K similar neighbors in Neo4j and connect them."""
    if not new_nodes:
        return

    logger.info("Linking %d new nodes via Neo4j Vector Search...", len(new_nodes))
    for node in new_nodes:
        if not node.embedding:
            continue

        # Increased threshold from 0.75 to 0.82 and added keyword check hint
        search_query = """
        CALL db.index.vector.queryNodes('node_embeddings', 10, $vector)
        YIELD node, score
        WHERE node.id <> $current_id AND score > 0.82
        
        // Ensure some keyword overlap to prevent false semantic matches
        WITH node, score
        MATCH (current:Event {id: $current_id})
        WHERE any(k IN node.key_elements WHERE k IN current.key_elements)
        
        RETURN node.id as neighbor_id, score
        """
        try:
            results = neo4j_client.execute_query(search_query, {
                "vector": node.embedding,
                "current_id": node.id
            })

            if not results:
                continue

            # ✅ Batch all MERGE link queries for this node in one call
            neighbor_ids = [r['neighbor_id'] for r in results]
            link_query = """
            UNWIND $neighbor_ids AS neighbor_id
            MATCH (a:Event {id: $source_id})
            MATCH (b:Event {id: neighbor_id})
            MERGE (a)-[:CONNECTED_TO]-(b)
            """
            neo4j_client.execute_query(link_query, {
                "source_id": node.id,
                "neighbor_ids": neighbor_ids
            })

        except Exception as e:
            logger.warning(f"Linking failed for node {node.id[:8]}: {e}")

    logger.info("✅ Finished semantic linking sweep.")


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