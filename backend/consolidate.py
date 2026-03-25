import os
import sys
import uuid
import logging

# Ensure the root directory is in sys.path for internal module imports
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from model.build_graph import load_nodes, save_nodes, Node
from model.llm import chat_llm_json, get_embedding
from model.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

GRAPH_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "graph.json")

SYSTEM_PROMPT = """You are an AI Graph Optimizer.
Your job is to read a list of past news events and consolidate them to prevent clutter.
Identify groups of 3 or more nodes that describe the EXACT SAME ongoing macro-event or developing story.
For each group you find, merge them into ONE single new summarized macro-node.

For each macro-node, output a JSON object with:
- "replaced_ids": list of the original node IDs that this macro-node replaces. (Must be at least 3 IDs)
- "content": A 2-3 sentence overarching summary of the merged events. Start it with "[MACRO SUMMARY]"
- "key_elements": lowercase list of key entities/topics.
- "domain": the domain category.

RULES:
- DO NOT merge distinct structural events just because they share a domain. Only merge continuous updates on the exact same story.
- Only return a JSON array of these summary objects.
- Do NOT return anything else."""

def run_consolidation():
    logger.info("Starting AI node consolidation cycle...")
    nodes = load_nodes(GRAPH_PATH)
    
    if len(nodes) < 50:
        logger.info("Graph too small for consolidation. Skipping.")
        return

    # We target nodes older than the 'living memory' limit (default 150)
    retention = int(os.getenv("graph_HISTORY_RETENTION", 150))
    oldest_nodes = nodes[:-retention] 
    
    if len(oldest_nodes) < 10:
        logger.info("Not enough old nodes to consolidate. Skipping.")
        return

    # Process in batches of 40 to maintain LLM context quality
    batch = oldest_nodes[:40]
    
    prompt_parts = []
    for n in batch:
        prompt_parts.append(f"ID: {n.id}\nDomain: {n.domain}\nContent: {n.content}\nKeys: {', '.join(n.key_elements)}\n---")
        
    prompt = "\n".join(prompt_parts)
    
    try:
        logger.info(f"Sending {len(batch)} old nodes to Gemini for topic clustering...")
        results = chat_llm_json(prompt, SYSTEM_PROMPT)
        
        if isinstance(results, dict):
            results = [results]
            
        if not results:
            logger.info("LLM found no narrative groups to consolidate.")
            return
            
        nodes_dict = {n.id: n for n in nodes}
        ids_to_remove = set()
        new_nodes = []
        
        for group in results:
            replaced = group.get("replaced_ids", [])
            if len(replaced) < 2:
                continue
                
            new_id = str(uuid.uuid4())
            new_node = Node(
                id=new_id,
                content=group.get("content", "[MACRO SUMMARY] Compiled Event."),
                key_elements=group.get("key_elements", []),
                domain=group.get("domain", "geopolitics"),
                speculation=False,
                reference="AI Nightly Consolidation",
                next=[],
                prev=[]
            )
            
            # Reconnect edges
            for rid in replaced:
                if rid in nodes_dict:
                    old_node = nodes_dict[rid]
                    new_node.next.extend([nid for nid in old_node.next if nid not in replaced])
                    new_node.prev.extend([nid for nid in old_node.prev if nid not in replaced])
                    ids_to_remove.add(rid)
                    
            new_node.next = list(set(new_node.next))
            new_node.prev = list(set(new_node.prev))
            
            new_nodes.append(new_node)
            logger.info(f"Consolidated {len(replaced)} nodes into macro-node: {new_node.id[:8]}")

        if not ids_to_remove:
            return

        final_nodes = [n for n in nodes if n.id not in ids_to_remove]
        
        # Link old dangling pointers to the new macro node
        macro_map = {}
        for group, nn in zip([g for g in results if len(g.get("replaced_ids", [])) >= 2], new_nodes):
            for rid in group.get("replaced_ids", []):
                macro_map[rid] = nn.id

        for n in final_nodes:
            n.next = list(set([macro_map.get(t, t) for t in n.next if t not in ids_to_remove or t in macro_map]))
            n.prev = list(set([macro_map.get(t, t) for t in n.prev if t not in ids_to_remove or t in macro_map]))

        final_nodes.extend(new_nodes)
        
        # Sync to Neo4j
        logger.info("Synchronizing consolidation changes to Neo4j...")
        for nn in new_nodes:
            # 1. Create macro node in Neo4j
            nn.embedding = get_embedding(nn.content)
            create_query = """
            MERGE (e:Event {id: $id})
            SET e.content = $content,
                e.domain = $domain,
                e.key_elements = $key_elements,
                e.speculation = $speculation,
                e.reference = $reference,
                e.timestamp = datetime($timestamp),
                e.embedding = $embedding
            """
            neo4j_client.execute_query(create_query, nn.model_dump(mode="json"))

        # 2. Re-link nodes and delete old ones in Neo4j
        for rid in ids_to_remove:
            # Move relationships to macro node if they exist
            target_macro_id = macro_map.get(rid)
            if target_macro_id:
                # Re-route incoming
                neo4j_client.execute_query("""
                    MATCH (a)-[r:CONNECTED_TO]->(old:Event {id: $rid})
                    MATCH (new:Event {id: $macro_id})
                    MERGE (a)-[:CONNECTED_TO]->(new)
                    DELETE r
                """, {"rid": rid, "macro_id": target_macro_id})
                # Re-route outgoing
                neo4j_client.execute_query("""
                    MATCH (old:Event {id: $rid})-[r:CONNECTED_TO]->(b)
                    MATCH (new:Event {id: $macro_id})
                    MERGE (new)-[:CONNECTED_TO]->(b)
                    DELETE r
                """, {"rid": rid, "macro_id": target_macro_id})
            
            # Delete the old node
            neo4j_client.execute_query("MATCH (e:Event {id: $rid}) DETACH DELETE e", {"rid": rid})

        save_nodes(final_nodes, GRAPH_PATH)
        logger.info(f"✅ Consolidation complete. Shrunk {len(ids_to_remove)} redundant nodes into {len(new_nodes)} macro-nodes in both JSON and Neo4j.")

    except Exception as e:
        logger.error(f"Consolidation failed: {e}")

if __name__ == "__main__":
    run_consolidation()
