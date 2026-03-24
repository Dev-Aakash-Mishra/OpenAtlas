import os
import sys
import time
import threading
import feedparser
import logging
import re
import requests

# Ensure the root directory is in sys.path for internal module imports
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)
# In-function imports used to break circularity
from backend.consolidate import run_consolidation

logger = logging.getLogger(__name__)

FEEDS = [
    # World News
    "https://feeds.bbci.co.uk/news/world/rss.xml",          # BBC (https fix)
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", # NYT World (replaces CNBC general)

    # Business / Finance
    "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",  # MarketWatch
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",

    # Technology
    "https://techcrunch.com/feed/",
    "https://www.wired.com/feed/rss",                        # fixed domain

    # Science
    "https://www.sciencedaily.com/rss/all.xml",
    "https://www.newscientist.com/feed/home/",               # adds New Scientist

    # Health / Medical
    "https://www.medicalnewstoday.com/feed/rss/articles",
    "https://feeds.webmd.com/rss/rss.aspx/WebMD-News",      # adds WebMD

    # Environment
    "https://grist.org/feed/",
    "https://www.theguardian.com/environment/rss",           # adds Guardian Env.

    # Defense / Geopolitics
    "https://www.defensenews.com/arc/outboundfeeds/rss/category/global/",
]

INDIA_FEEDS = [
    # Times of India
    "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    "https://timesofindia.indiatimes.com/rssfeeds/1221656.cms",  # TOI India

    # NDTV
    "https://feeds.feedburner.com/ndtvnews-top-stories",
    "https://feeds.feedburner.com/ndtvnews-india-news",

    # The Hindu
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://www.thehindu.com/feeder/default.rss",              # All sections

    # Hindustan Times
    "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    "https://www.hindustantimes.com/feeds/rss/top-news/rssfeed.xml",

    # Indian Express
    "https://indianexpress.com/feed/",
    "https://indianexpress.com/section/india/feed/",

    # India Today
    "https://www.indiatoday.in/rss/home",
    "https://www.indiatoday.in/rss/1206513",                    # India Today India

    # Mint (Business/Finance)
    "https://www.livemint.com/rss/news",

    # Economic Times
    "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
    "https://economictimes.indiatimes.com/news/india/rssfeeds/1068164.cms",

    # Wire

    # ANI News

    # Firstpost (your original)
    "https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml",                  # Updated path
]

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "model", ".cache")
global_seen_links = set()

worker_status = {
    "state": "idle",
    "message": "System Ready",
    "last_run": time.time(),
    "error": None
}

def fetch_and_ingest(region="global"):
    global global_seen_links, worker_status
    
    feeds_to_use = FEEDS if region == "global" else INDIA_FEEDS
    display_name = "Global" if region == "global" else "India"
    
    worker_status["state"] = "fetching"
    worker_status["message"] = f"Connecting to {display_name} news feeds..."
    worker_status["last_run"] = time.time()
    worker_status["error"] = None
    
    logger.info("Starting live feed ingestion cycle...")
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(CACHE_DIR, "live_feed_tmp.txt")
    
    blocks = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for url in feeds_to_use:
        try:
            # Use requests to bypass bot-detection on many Indian news sites
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                logger.warning("Failed to fetch feed %s: HTTP %s", url, response.status_code)
                continue
                
            feed = feedparser.parse(response.content)
            for entry in feed.entries[:5]: # Top 5 from each feed
                link = entry.get("link", "")
                if link in global_seen_links:
                    continue
                global_seen_links.add(link)
                
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
                
                block = (
                    f"TITLE: {title}\n"
                    f"LINK: {link}\n"
                    f"DATE: {pubDate}\n"
                    f"IMAGE_URL: {image_url}\n"
                    f"BODY:\n{summary_text}\n"
                    f"{'='*80}"
                )
                blocks.append(block)
        except Exception as e:
            logger.error(f"Error fetching feed {url}: {e}")
            
    if blocks:
        worker_status["state"] = "processing"
        worker_status["message"] = f"Analyzing {len(blocks)} new articles via AI..."
        
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write("\n".join(blocks))
            
        logger.info(f"Wrote {len(blocks)} articles to temporary cache. Generating nodes via LLM for region: {region}...")
        try:
            from main import create_nodes
            create_nodes(cache_path, region=region)
            worker_status["state"] = "idle"
            worker_status["message"] = "Successfully updated intelligence graph."
            logger.info("✅ Live feed ingestion and graph update successful.")
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "ResourceExhausted" in err_msg or "Rate limit" in err_msg:
                worker_status["state"] = "rate-limited"
                worker_status["message"] = "AI Rate Limit hit. Waiting for cooldown..."
                worker_status["error"] = "RateLimitExceeded"
            else:
                worker_status["state"] = "error"
                worker_status["message"] = f"Ingestion failed: {err_msg[:50]}"
                worker_status["error"] = err_msg
            logger.error(f"Node creation failed during live ingest: {e}")
    else:
        worker_status["state"] = "idle"
        worker_status["message"] = "No new articles found in this cycle."

def start_background_worker(interval_seconds=60): 
    def worker():
        # First wait slightly so the server spins up first
        time.sleep(5)
        cycles = 0
        while True:
            # 1. Fetch Global News
            fetch_and_ingest(region="global")
            time.sleep(10) # Small breather

            # 2. Fetch India News
            fetch_and_ingest(region="India")
            
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
