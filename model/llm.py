from google import genai
from openai import OpenAI  # pip install openai
import os
import json
import time
import logging
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

logger = logging.getLogger(__name__)

# ── Gemini (primary) ─────────────────────────────────────────────────────────
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL  = "gemini-2.0-flash"

# ── OpenRouter (fallback) ─────────────────────────────────────────────────────
_or_key = os.getenv("OPENROUTER_API_KEY", "")
_wait = int(os.getenv("WAIT_TIME", 20))
openrouter = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=_or_key,
) if _or_key else None

OR_CHAT_MODEL  = "google/gemini-2.0-flash-001"
OR_EMBED_MODEL = "openai/text-embedding-3-small"

MAX_RETRIES = 5

# ── Circuit breaker state ─────────────────────────────────────────────────────
_GEMINI_COOLDOWN_SECS = 60 * 10  # try Gemini again after 10 minutes
_STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".circuit_state.json")

def _load_state():
    if not os.path.exists(_STATE_FILE):
        return {"chat_blocked_until": 0.0, "embed_blocked_until": 0.0}
    try:
        with open(_STATE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {"chat_blocked_until": 0.0, "embed_blocked_until": 0.0}

def _save_state(state):
    try:
        with open(_STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        logger.error("Failed to save circuit state: %s", e)

def _gemini_chat_available() -> bool:
    state = _load_state()
    return time.time() >= state.get("chat_blocked_until", 0.0)

def _gemini_embed_available() -> bool:
    state = _load_state()
    return time.time() >= state.get("embed_blocked_until", 0.0)

def _block_gemini_chat() -> None:
    state = _load_state()
    state["chat_blocked_until"] = time.time() + _GEMINI_COOLDOWN_SECS
    _save_state(state)
    logger.warning(
        "🔴 Gemini chat circuit open — skipping for %d minutes.",
        _GEMINI_COOLDOWN_SECS // 60,
    )

def _block_gemini_embed() -> None:
    state = _load_state()
    state["embed_blocked_until"] = time.time() + _GEMINI_COOLDOWN_SECS
    _save_state(state)
    logger.warning(
        "🔴 Gemini embed circuit open — skipping for %d minutes.",
        _GEMINI_COOLDOWN_SECS // 60,
    )


def _is_rate_limit(err_str: str) -> bool:
    return "429" in err_str or "RESOURCE_EXHAUSTED" in err_str


# ── OpenRouter helpers ────────────────────────────────────────────────────────

def _openrouter_chat(query: str, system_prompt: str = None) -> str:
    if not openrouter:
        logger.error("OPENROUTER_API_KEY not set — cannot use fallback.")
        return ""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": query})
    resp = openrouter.chat.completions.create(model=OR_CHAT_MODEL, messages=messages)
    return resp.choices[0].message.content or ""


def _openrouter_embed(texts: list[str]) -> list[list[float]]:
    if not openrouter:
        logger.error("OPENROUTER_API_KEY not set — cannot use embed fallback.")
        return [[] for _ in texts]
    embeddings = []
    for text in texts:
        try:
            resp = openrouter.embeddings.create(model=OR_EMBED_MODEL, input=text)
            emb = resp.data[0].embedding   # 1536-dim
            embeddings.append(emb[:768])   # slice to match Neo4j index
            time.sleep(0.1)
        except Exception as e:
            logger.warning("OpenRouter embed failed for one text, using zero vector: %s", e)
            embeddings.append([0.0] * 768)
    return embeddings


# ── Chat ─────────────────────────────────────────────────────────────────────

def chat_llm(query: str, system_prompt: str = None) -> str:
    contents = []
    if system_prompt:
        contents.append({"role": "user",  "parts": [{"text": system_prompt}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    contents.append({"role": "user", "parts": [{"text": query}]})

    # ── Skip Gemini entirely if circuit is open ───────────────────────────────
    if not _gemini_chat_available():
        logger.info("⚡ Gemini circuit open — routing directly to OpenRouter.")
        try:
            return _openrouter_chat(query, system_prompt)
        except Exception as e:
            logger.error("OpenRouter chat failed: %s", e)
            return ""

    # ── Primary: Gemini ───────────────────────────────────────────────────────
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(model=MODEL, contents=contents)
            return response.text
        except Exception as e:
            err = str(e).upper()
            if _is_rate_limit(err):
                wait = _wait * (attempt)
                logger.warning(
                    "Gemini rate limit hit. Retrying %d/%d in %ds...",
                    attempt, MAX_RETRIES, wait,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
            else:
                logger.error("Gemini LLM call failed: %s", e)
                return ""

    # ── All retries exhausted → open circuit, fall back ──────────────────────
    _block_gemini_chat()
    logger.warning("⚡ Gemini exhausted — falling back to OpenRouter (%s)", OR_CHAT_MODEL)
    try:
        return _openrouter_chat(query, system_prompt)
    except Exception as e:
        logger.error("OpenRouter fallback also failed: %s", e)
        return ""


# ── JSON wrapper ──────────────────────────────────────────────────────────────

def chat_llm_json(query: str, system_prompt: str = None) -> list | dict:
    raw = chat_llm(query, system_prompt)
    if not raw:
        return []
    
    # Improved regex to find JSON blocks (list or dict)
    import re
    match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', raw)
    if match:
        json_str = match.group(0)
        try:
            return json.loads(json_str)
        except Exception as e:
            logger.error("JSON parse failed: %s", e)
            return []
    
    # Fallback to simple load if no regex match
    try:
        return json.loads(raw.strip())
    except Exception:
        return []


# ── Embeddings ────────────────────────────────────────────────────────────────

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    # ── Skip Gemini entirely if circuit is open ───────────────────────────────
    if not _gemini_embed_available():
        logger.info("⚡ Gemini embed circuit open — routing directly to OpenRouter.")
        return _openrouter_embed(texts)

    # ── Primary: Gemini batch embed ───────────────────────────────────────────
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.embed_content(
                model="models/gemini-embedding-2-preview",
                contents=texts,
                config={"output_dimensionality": 768}
            )
            return [e.values for e in response.embeddings]
        except Exception as e:
            err = str(e).upper()
            if _is_rate_limit(err):
                wait = 5 * attempt
                logger.warning(
                    "Gemini embed rate limit. Retrying %d/%d in %ds...",
                    attempt, MAX_RETRIES, wait,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
            else:
                logger.error("Gemini batch embedding failed: %s", e)
                return [[0.0] * 768 for _ in texts]

    # ── All retries exhausted → open circuit, fall back ──────────────────────
    _block_gemini_embed()
    logger.warning("⚡ Gemini embed exhausted — falling back to OpenRouter (%s)", OR_EMBED_MODEL)
    return _openrouter_embed(texts)


def get_embedding(text: str) -> list[float]:
    if not text.strip():
        return []
    res = get_embeddings_batch([text])
    return res[0] if res else []