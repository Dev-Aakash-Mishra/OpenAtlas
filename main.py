import os
import logging
import networkx as nx
from model.llm import chat_llm_json
from model.build_graph import Node, save_nodes, load_nodes

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

RULES:
- Return a JSON array, one object per distinct event. Merge duplicate events.
- SKIP articles that are not relevant or old.
- Do NOT include the fields: id, prev, next, reference, timestamp.
- Return ONLY valid JSON."""

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
        body = lines[2].strip() if len(lines) > 2 else ""

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

    prompt_parts: list[str] = []
    for idx, art in enumerate(articles, 1):
        prompt_parts.append(
            f"--- ARTICLE {idx} ---\n"
            f"Title: {art['title']}\n"
            f"Date: {art['date']}\n"
            f"URL: {art['url']}\n\n"
            f"{art['body']}\n"
        )

    user_prompt = "\n".join(prompt_parts)
    logger.info("Sending %d articles to LLM in 1 call (~%d chars)",
                len(articles), len(user_prompt))

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
                reference=cache_path,
            ))

        logger.info("✅ LLM returned %d nodes", len(all_new_nodes))

    except Exception as e:
        logger.error("❌ LLM call failed: %s", e)

    _link_nodes(existing_nodes + all_new_nodes)

    all_nodes = existing_nodes + all_new_nodes
    save_nodes(all_nodes, GRAPH_PATH)
    logger.info("Saved %d total nodes (%d new) to %s",
                len(all_nodes), len(all_new_nodes), GRAPH_PATH)

    return all_nodes


def _link_nodes(nodes: list[Node]) -> None:
    for i, node_a in enumerate(nodes):
        for j, node_b in enumerate(nodes):
            if i >= j:
                continue
            shared = set(node_a.key_elements) & set(node_b.key_elements)
            if len(shared) >= 2:
                if node_b.id not in node_a.next:
                    node_a.next.append(node_b.id)
                if node_a.id not in node_b.prev:
                    node_b.prev.append(node_a.id)


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
