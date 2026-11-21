"""Optional: Claude rewords tips in friendly French. Numbers never come from it.

Only active when LLM_API_KEY is set. The tip texts (already containing the
kWh and DT computed by the tariff module) are sent; the model may only change
the wording. We then check that every number of the original is still there
and no number was added; otherwise we keep the template text. Any error or
timeout also falls back to the templates, so the demo never depends on it.
"""

import json
import logging
import re
from collections import Counter

from app.config import get_settings

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Tu reformules des conseils d'économie d'énergie et d'eau pour un foyer tunisien. "
    "Écris en français, en tutoyant, sur un ton amical et direct, en phrases courtes. "
    "Garde exactement tous les nombres et leurs unités (kWh, DT, L, W, h) tels qu'ils sont écrits : "
    "n'en ajoute pas, n'en supprime pas, n'en change aucun. N'ajoute aucun nouveau conseil. "
    "Rends la liste reformulée dans le même ordre."
)

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"tips": {"type": "array", "items": {"type": "string"}}},
    "required": ["tips"],
    "additionalProperties": False,
}

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_client = None


def numbers_in(text: str) -> Counter:
    compact = text.replace(" ", "").replace(" ", "")  # "1 234,5" -> "1234,5"
    return Counter(n.replace(",", ".") for n in _NUMBER.findall(compact))


def same_numbers(original: str, reworded: str) -> bool:
    return numbers_in(original) == numbers_in(reworded)


def _get_client():
    global _client
    if _client is None:
        import anthropic  # optional dependency, imported only when used

        settings = get_settings()
        _client = anthropic.Anthropic(api_key=settings.llm_api_key, timeout=settings.llm_timeout_s, max_retries=1)
    return _client


def reword_tips(texts: list[str]) -> list[str | None] | None:
    """Reworded texts (None where the check failed), or None if the LLM is off/failed."""
    settings = get_settings()
    if not settings.llm_api_key or not texts:
        return None
    try:
        response = _get_client().beta.messages.create(
            model=settings.llm_model,
            max_tokens=2000,
            # If the model declines, the API retries on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps({"tips": texts}, ensure_ascii=False)}],
        )
        if response.stop_reason != "end_turn":
            log.warning("LLM tips: stop_reason=%s, using templates", response.stop_reason)
            return None
        text = next(block.text for block in response.content if block.type == "text")
        reworded = json.loads(text)["tips"]
    except Exception as exc:  # network, timeout, quota, bad JSON: templates are always fine
        log.warning("LLM tips unavailable (%s), using templates", type(exc).__name__)
        return None
    if len(reworded) != len(texts):
        return None
    return [new if isinstance(new, str) and same_numbers(old, new) else None for old, new in zip(texts, reworded)]
