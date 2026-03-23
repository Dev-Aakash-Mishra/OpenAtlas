import os
import sys
import time
import threading
import feedparser
import logging
import re

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from main import create_nodes
from consolidate import run_consolidation

logger = logging.getLogger(__name__)

FEEDS = [
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "https://techcrunch.com/feed/",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html" # Finance
]

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "model", ".cache")

def fetch_and_ingest(seen_links=None):
    if seen_links is None:
        seen_links = set()
        
    logger.info("Starting live feed ingestion cycle...")
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(CACHE_DIR, "live_feed_tmp.txt")
    
    blocks = []
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:2]: # Top 2 from each feed to prevent huge LLM token use at once
                link = entry.get("link", "")
                if link in seen_links:
                    continue
                seen_links.add(link)
                
                title = entry.get("title", "")
                pubDate = entry.get("published", entry.get("pubDate", ""))
                summary = entry.get("summary", "")
                
                # Extract image thumbnail URL
                image_url = ""
                if "media_content" in entry and len(entry.media_content) > 0:
                    image_url = entry.media_content[0].get("url", "")
                elif "links" in entry:
                    for lk in entry.links:
                        if "image" in lk.get("type", ""):
                            image_url = lk.get("href", "")
                            break
                
                # Basic strip HTML from summary
                summary_text = re.sub(r'<[^>]+>', '', summary)
                
                block = f"{pubDate}, {link}, {title}\nURL: {link}\nIMAGE_URL: {image_url}\n{summary_text}\n{'='*80}"
                blocks.append(block)
        except Exception as e:
            logger.error(f"Error fetching feed {url}: {e}")
            
    if blocks:
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write("\n".join(blocks))
            
        logger.info(f"Wrote {len(blocks)} articles to temporary cache. Generating nodes via LLM...")
        try:
            create_nodes(cache_path)
            logger.info("✅ Live feed ingestion and graph update successful.")
        except Exception as e:
            logger.error(f"Node creation failed during live ingest: {e}")

def start_background_worker(interval_seconds=60): 
    def worker():
        # First wait slightly so the server spins up first
        time.sleep(5)
        cycles = 0
        seen_links = set()
        while True:
            fetch_and_ingest(seen_links)
            
            # Run consolidation every 60 cycles (e.g. 1 hour if interval is 60s)
            cycles += 1
            if cycles >= 60:
                logger.info("Triggering scheduled graph consolidation...")
                run_consolidation()
                cycles = 0
                
            logger.info(f"Worker sleeping for {interval_seconds}s...")
            time.sleep(interval_seconds)
            
    t = threading.Thread(target=worker, daemon=True)
    t.start()
    return t
