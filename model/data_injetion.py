import os
import re
import logging
import requests
import feedparser
from datetime import datetime, date
from typing import Callable
from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(_ENV_PATH)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

TAVILY_API_KEY     = os.getenv("TAVILY_API_KEY", "")
MEDIASTACK_API_KEY = os.getenv("MEDIASTACK_API_KEY", "")
SERPAPI_KEY         = os.getenv("SERPAPI_KEY", "")

TODAY = date.today().isoformat()

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

PAID_LIMIT = 3
FREE_LIMIT = 10

def _scrape_article_content(url: str) -> str:
    if not url or url in ("N/A", "None", None):
        return ""
    try:
        r = requests.get(url, timeout=10, headers=_HEADERS)
        r.raise_for_status()
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", r.text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"&[a-zA-Z]+;", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:3000]
    except Exception as e:
        logger.warning("Scrape failed for %s: %s", url, e)
        return ""

def _save_to_cache(articles: list[dict]) -> str:
    now = datetime.now()
    filename = now.strftime("%d%m%Y%H%M") + ".txt"
    filepath = os.path.join(CACHE_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        for i, a in enumerate(articles, 1):
            pub   = a.get("published", "N/A")
            url   = a.get("url", "N/A")
            title = a.get("title", "N/A")

            logger.info("Scraping [%d/%d] %s", i, len(articles), url)
            content = _scrape_article_content(url)
            if not content:
                content = a.get("description", "")

            f.write(f"{pub}, {url}, {title}\n\n")
            f.write(f"{content}\n")
            f.write("\n" + "=" * 80 + "\n\n")

    logger.info("Cache written → %s  (%d articles)", filepath, len(articles))
    return filepath

def fetch_tavily(query: str = "latest world news today", limit: int = 3) -> list[dict]:
    logger.info("Tavily — query=%r  limit=%d", query, limit)
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "include_answer": True,
        "max_results": limit,
        "topic": "news",
    }
    r = requests.post(url, json=payload)
    data = r.json()
    if not data.get("results"):
        logger.warning("Tavily returned 0 results. Response: %s", str(data)[:300])
    articles: list[dict] = []
    for a in data.get("results", []):
        articles.append({
            "source": "Tavily",
            "title": a.get("title"),
            "description": a.get("content", "")[:200],
            "url": a.get("url"),
            "published": a.get("published_date", "N/A"),
        })
    logger.info("Tavily — fetched %d articles", len(articles))
    return articles

def fetch_mediastack(query: str = "world", limit: int = 3) -> list[dict]:
    logger.info("MediaStack — query=%r  limit=%d", query, limit)
    url = "http://api.mediastack.com/v1/news"
    params = {
        "access_key": MEDIASTACK_API_KEY,
        "keywords": query,
        "languages": "en",
        "limit": limit,
    }
    r = requests.get(url, params=params)
    data = r.json()
    if not data.get("data"):
        logger.warning("MediaStack returned 0 articles. Response: %s", str(data)[:300])
    articles: list[dict] = []
    for a in data.get("data", []):
        articles.append({
            "source": "MediaStack",
            "title": a.get("title"),
            "description": a.get("description", ""),
            "url": a.get("url"),
            "published": a.get("published_at"),
        })
    logger.info("MediaStack — fetched %d articles", len(articles))
    return articles

def fetch_serpapi(query: str = "world news today", limit: int = 3) -> list[dict]:
    logger.info("SerpAPI — query=%r  limit=%d", query, limit)
    url = "https://serpapi.com/search"
    params = {
        "engine": "google_news",
        "q": query,
        "api_key": SERPAPI_KEY,
    }
    r = requests.get(url, params=params)
    data = r.json()
    if not data.get("news_results"):
        logger.warning("SerpAPI returned 0 results. Response: %s", str(data)[:300])
    articles: list[dict] = []
    for a in data.get("news_results", [])[:limit]:
        articles.append({
            "source": "SerpAPI-GoogleNews",
            "title": a.get("title"),
            "description": a.get("snippet", ""),
            "url": a.get("link"),
            "published": a.get("date", "N/A"),
        })
    logger.info("SerpAPI — fetched %d articles", len(articles))
    return articles

def fetch_hackernews(query: str = "news", limit: int = 10) -> list[dict]:
    logger.info("HackerNews — limit=%d", limit)
    top_ids = requests.get(
        "https://hacker-news.firebaseio.com/v0/topstories.json"
    ).json()[:limit]

    articles: list[dict] = []
    for story_id in top_ids:
        story = requests.get(
            f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
        ).json()
        articles.append({
            "source": "HackerNews",
            "title": story.get("title"),
            "description": story.get("text", "")[:200],
            "url": story.get("url", f"https://news.ycombinator.com/item?id={story_id}"),
            "published": datetime.fromtimestamp(story.get("time", 0)).isoformat(),
        })
    logger.info("HackerNews — fetched %d articles", len(articles))
    return articles

def fetch_rss(query: str = "world", limit: int = 10) -> list[dict]:
    logger.info("RSS — limit=%d per feed", limit)
    feeds: dict[str, str] = {
        "BBC":        "http://feeds.bbci.co.uk/news/world/rss.xml",
        "Reuters":    "https://feeds.reuters.com/reuters/topNews",
        "Al Jazeera": "https://www.aljazeera.com/xml/rss/all.xml",
        "CNN":        "http://rss.cnn.com/rss/edition_world.rss",
        "Guardian":   "https://www.theguardian.com/world/rss",
        "NPR":        "https://feeds.npr.org/1004/rss.xml",
        "NYTimes":    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "DW":         "https://rss.dw.com/xml/rss-en-world",
        "France24":   "https://www.france24.com/en/rss",
        "IndiaToday": "https://www.indiatoday.in/rss/home",
    }
    articles: list[dict] = []
    for name, url in feeds.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:limit]:
                articles.append({
                    "source": f"RSS-{name}",
                    "title": entry.get("title"),
                    "description": entry.get("summary", "")[:200],
                    "url": entry.get("link"),
                    "published": entry.get("published", "N/A"),
                })
        except Exception as e:
            logger.warning("RSS %s failed: %s", name, e)
    logger.info("RSS — fetched %d articles total", len(articles))
    return articles

def fetch_all_news(query: str = "world news") -> list[dict]:
    logger.info("=" * 60)
    logger.info("PIPELINE START — query=%r  paid_limit=%d  free_limit=%d",
                query, PAID_LIMIT, FREE_LIMIT)
    logger.info("=" * 60)

    all_articles: list[dict] = []

    fetchers: list[tuple[str, Callable[..., list[dict]], int]] = [
        ("Tavily",      fetch_tavily,      PAID_LIMIT),
        ("MediaStack",  fetch_mediastack,  PAID_LIMIT),
        ("SerpAPI",     fetch_serpapi,      PAID_LIMIT),
        ("HackerNews",  fetch_hackernews,  FREE_LIMIT),
        ("RSS",         fetch_rss,         FREE_LIMIT),
    ]

    for name, fn, lim in fetchers:
        try:
            results = fn(query=query, limit=lim)
            all_articles.extend(results)
            logger.info("✅ %s — %d articles", name, len(results))
        except Exception as e:
            logger.error("❌ %s failed: %s", name, e)

    cache_path = _save_to_cache(all_articles)
    logger.info("📰 Total articles fetched: %d", len(all_articles))
    logger.info("💾 Cached to: %s", cache_path)
    return all_articles

if __name__ == "__main__":
    articles = fetch_all_news(query="world news")
    for a in articles[:5]:
        print(f"\n[{a['source']}] {a['title']}")
        print(f"  {a['url']}")