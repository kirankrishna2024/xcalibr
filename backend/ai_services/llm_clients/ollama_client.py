# ai_services/llm_clients/ollama_client.py
import json
import logging
import requests
from typing import Dict, Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEFAULT_MODEL = "llama3"
OLLAMA_BASE_URL = "http://localhost:11434"


def check_ollama_available() -> bool:
    """Check if Ollama server is running and reachable."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


def check_model_available(model_name: str) -> bool:
    """Check if a specific model is pulled and ready in Ollama."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            models_data = resp.json()
            model_names = [m.get("name", "") for m in models_data.get("models", [])]
            return any(model_name in m for m in model_names)
    except Exception:
        pass
    return False


def invoke_ollama_json(
    model_name: str,
    system_prompt: str,
    user_content: str,
    temperature: float = 0.3
) -> Dict[str, Any]:
    """
    Invokes Ollama model expecting a JSON response.
    Uses direct HTTP API for reliability.
    Raises RuntimeError with a clear message if Ollama is unreachable or model is missing.
    Raises ValueError if the response is not valid JSON.
    """
    model_name = DEFAULT_MODEL  # Always use llama3

    # Pre-flight checks with actionable error messages
    if not check_ollama_available():
        raise RuntimeError(
            "Ollama server is not running. "
            "Please start it with: ollama serve"
        )

    if not check_model_available(model_name):
        raise RuntimeError(
            f"Ollama model '{model_name}' is not available. "
            f"Please pull it with: ollama pull {model_name}"
        )

    logger.info(f"Sending request to Ollama model: {model_name}")

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
        }
    }

    try:
        # INCREASED TIMEOUT: Changed from 180 to 600 to prevent local hardware timeouts
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=600  
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Ollama model '{model_name}' timed out after 10 minutes. "
            "The model may still be loading or your hardware is under heavy load. Please wait and retry."
        )
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Cannot connect to Ollama. "
            "Please ensure Ollama is running: ollama serve"
        )
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f"Ollama API returned an HTTP error: {e}")

    try:
        response_data = response.json()
    except Exception:
        raise ValueError("Ollama returned a non-JSON response body.")

    raw_content = response_data.get("message", {}).get("content", "")

    if not raw_content or not raw_content.strip():
        raise ValueError(
            f"Ollama model '{model_name}' returned an empty response. "
            "The model may have failed silently."
        )

    # Strip markdown fences if present
    cleaned = raw_content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    if not cleaned:
        raise ValueError("Ollama response was empty after stripping markdown fences.")

    try:
        parsed = json.loads(cleaned)
        logger.info("Successfully parsed JSON from Ollama.")
        return parsed
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed. Raw response: {cleaned[:300]}")
        raise ValueError(
            f"Ollama returned invalid JSON. Error: {e}. "
            f"Raw (first 200 chars): {raw_content[:200]}"
        ) from e