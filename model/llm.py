from google import genai
import os
import json
import time
import logging
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

logger = logging.getLogger(__name__)

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

MODEL = "gemini-2.5-flash"

MAX_RETRIES = 5

def chat_llm(query: str, system_prompt: str = None) -> str:
    contents = []
    if system_prompt:
        contents.append({"role": "user", "parts": [{"text": system_prompt}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    contents.append({"role": "user", "parts": [{"text": query}]})

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(model=MODEL, contents=contents)
            return response.text
        except Exception as e:
            err = str(e).upper()
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                # Exponential backoff: 30, 60, 120, 240, 480
                wait = 30 * (2 ** (attempt - 1))
                logger.warning("Rate limit hit (429/ResourceExhausted). Retrying %d/%d in %ds...",
                               attempt, MAX_RETRIES, wait)
                time.sleep(wait)
            else:
                logger.error("LLM call failed with error: %s", e)
                raise
    raise RuntimeError(f"Failed to communicate with Gemini after {MAX_RETRIES} attempts due to rate limiting.")


def chat_llm_json(query: str, system_prompt: str = None) -> list | dict:
    raw = chat_llm(query, system_prompt)
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return json.loads(raw.strip())


def get_embedding(text: str) -> list[float]:
    if not text.strip():
        return []
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # We use gemini-embedding-2-preview with output_dimensionality=768 to match Neo4j
            response = client.models.embed_content(
                model="models/gemini-embedding-2-preview",
                contents=text,
                config={"output_dimensionality": 768}
            )
            return response.embeddings[0].values
        except Exception as e:
            err = str(e).upper()
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                wait = 15 * attempt
                logger.warning("Embedding Rate limit hit. Waiting %ds...", wait)
                time.sleep(wait)
            else:
                logger.error("Embedding failed: %s", e)
                return []
    return []