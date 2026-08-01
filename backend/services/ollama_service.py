"""
OllamaService — wraps Gemma2:2b for all text generation operations.
Ported and adapted from test/ollama_compute.py for production FastAPI integration.
"""

import json
import os
import subprocess

try:
    import ollama as _ollama_lib
    HAS_OLLAMA_LIB = True
except Exception:
    _ollama_lib = None
    HAS_OLLAMA_LIB = False

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

# ---------------------------------------------------------------------------
# Prompt Actions (mirrors test/ollama_compute.py build_prompt logic)
# ---------------------------------------------------------------------------

ACTION_INSTRUCTIONS: dict[str, str] = {
    "generate":          "Generate content based on the provided prompt and context.",
    "rewrite":           "Rewrite the draft. Improve wording and clarity while preserving original meaning and facts.",
    "expand":            "Expand the draft. Add details, examples, and useful elaboration to enrich the content.",
    "summarize":         "Summarize the draft. Produce a concise summary matching the target length.",
    "improve_tone":      "Improve the tone and polish. Fix awkward phrasing, grammar, and flow.",
    "change_audience":   "Re-target the draft to the requested audience, adjusting vocabulary, assumptions, and level of detail.",
    "atomize_format":    "Atomize the content into the specified format. Ensure it fits the target audience and mood.",
    "image_prompt":      "Convert the following description into a high-quality Stable Diffusion positive prompt. Output ONLY the prompt. Use descriptive visual tags: subject, environment, lighting, style, artist reference, camera, quality tags. No explanation, no preamble.",
}


def build_prompt(
    prompt: str,
    draft: str = "",
    action: str = "generate",
    mood: str = "Professional",
    style: str = "Narrative",
    audience: str = "",
    content_length: str = "",
) -> str:
    """Assembles the final prompt string to send to Gemma."""
    prompt = prompt.strip()
    parts = [prompt]

    if draft:
        clean_draft = draft.strip()
        if len(clean_draft) > 12000:
            clean_draft = clean_draft[-12000:]
        parts.append("Current draft context:")
        parts.append(clean_draft)
        parts.append(
            "Use the draft above as the primary context. "
            "Base your response on the draft unless explicitly told otherwise."
        )

    instructions = []

    if mood and mood.lower() not in ("neutral", ""):
        instructions.append(f"Use a {mood.lower()} mood in the response.")
    if style and style.lower() not in ("narrative", ""):
        instructions.append(f"Write in a {style.lower()} style.")
    if content_length:
        instructions.append(f"Target length: {content_length}.")
    if audience:
        instructions.append(f"Write for: {audience}.")

    action_key = action.lower()
    action_instruction = ACTION_INSTRUCTIONS.get(action_key, f"Action: {action}.")
    instructions.append(action_instruction)

    if instructions:
        parts.append("Additional instructions:")
        parts.append(" ".join(instructions))

    parts.append(
        "CRITICAL: Output ONLY the requested generated text. "
        "Do NOT include any greetings, introductions, explanations, apologies, or footers. "
        "Provide only the raw text content."
    )
    return "\n\n".join(parts)


def _call_ollama_lib(model: str, final_prompt: str) -> str:
    """Call Ollama using the installed Python library."""
    client = _ollama_lib.Client()
    response = client.generate(model=model, prompt=final_prompt)
    if hasattr(response, "response"):
        return response.response.strip()
    if isinstance(response, dict):
        return response.get("response") or response.get("text") or str(response)
    return str(response)


def _call_ollama_http(model: str, final_prompt: str) -> str:
    """Fallback: call Ollama via its HTTP REST API."""
    import urllib.request
    payload = json.dumps({"model": model, "prompt": final_prompt, "stream": False}).encode()
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        blob = json.loads(resp.read().decode())
    return blob.get("response", "").strip()


class OllamaService:
    """Service layer for all Ollama / Gemma2:2b text operations."""

    @staticmethod
    def generate(
        prompt: str,
        draft: str = "",
        action: str = "generate",
        mood: str = "Professional",
        style: str = "Narrative",
        audience: str = "",
        content_length: str = "",
        model: str = OLLAMA_MODEL,
    ) -> str:
        """Run a text generation request through Gemma and return the result."""
        final_prompt = build_prompt(
            prompt,
            draft=draft,
            action=action,
            mood=mood,
            style=style,
            audience=audience,
            content_length=content_length,
        )

        # Try library first, then HTTP, then subprocess as last resort
        if HAS_OLLAMA_LIB:
            try:
                return _call_ollama_lib(model, final_prompt)
            except Exception:
                pass

        try:
            return _call_ollama_http(model, final_prompt)
        except Exception:
            pass

        # Subprocess fallback (least reliable)
        try:
            proc = subprocess.run(
                ["ollama", "run", model],
                input=final_prompt,
                check=True,
                capture_output=True,
                text=True,
                timeout=120,
            )
            result = proc.stdout.strip()
            if not result:
                raise RuntimeError("Ollama returned an empty response")
            return result
        except Exception as exc:
            raise RuntimeError("Ollama generation failed") from exc

    @staticmethod
    def enrich_image_prompt(user_prompt: str, model: str = OLLAMA_MODEL) -> str:
        """
        Use Gemma to convert a simple user description into a high-quality
        Stable Diffusion positive prompt (visual tags, style, lighting, quality).
        This runs BEFORE every ComfyUI image generation job.
        """
        return OllamaService.generate(
            prompt=user_prompt,
            action="image_prompt",
            model=model,
        )

    @staticmethod
    def atomize(
        parent_content: str,
        formats: list[str],
        mood: str = "Professional",
        audience: str = "",
        content_length: str = "",
        model: str = OLLAMA_MODEL,
    ) -> list[dict]:
        """
        Content Atomization: generate multiple child assets from one parent asset.
        Returns a list of dicts: {format, content}.
        """
        results = []
        for fmt in formats:
            generated = OllamaService.generate(
                prompt=f"Generate a {fmt} from the following content.",
                draft=parent_content,
                action="atomize_format",
                mood=mood,
                style=fmt,
                audience=audience,
                content_length=content_length,
                model=model,
            )
            results.append({"format": fmt, "content": generated})
        return results
