"""
ComfyUIService — drives the ComfyUI API for image generation.

Pipeline (per PROJECT_BIBLE.md / RULES.md):
  User prompt
      ↓ OllamaService.enrich_image_prompt()     ← Gemma enrichment FIRST
      ↓
  ComfyUI Dual-KSampler workflow
      ↓ KSampler 1 (base, low denoise)
      ↓ KSampler 2 (refine, high denoise)
      ↓ 4x Upscaler model
      ↓
  PNG saved to SSD
      ↓ Base64 response returned to frontend

RULES: Prompt enrichment must complete before image generation begins.
       Image generation always executes through ComfyUI.
       PostgreSQL stores only the file path, never raw binary.
"""

import json
import os
import time
import urllib.request
import urllib.parse
import uuid
from copy import deepcopy
from pathlib import Path

COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
DEFAULT_CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors"
WORKFLOW_PATH = Path(os.getenv(
    "COMFYUI_WORKFLOW_PATH",
    Path(__file__).resolve().parents[1] / "final4.json",
)).resolve()

# ---------------------------------------------------------------------------
# Positive quality boilerplate appended to every enriched prompt
# ---------------------------------------------------------------------------
QUALITY_SUFFIX = (
    "masterpiece, best quality, ultra-detailed, sharp focus, 8k, "
    "professional photography, intricate details, award winning"
)

# ---------------------------------------------------------------------------
# Negative prompt — standard for epiCRealism / ToonYou
# ---------------------------------------------------------------------------
NEGATIVE_PROMPT = (
    "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, "
    "extra digit, fewer digits, cropped, worst quality, low quality, "
    "normal quality, jpeg artifacts, signature, watermark, username, blurry, "
    "out of focus, ugly, bad proportions, deformed, mutated, disfigured"
)


def _build_workflow(
    enriched_prompt: str,
    model_filename: str | None = DEFAULT_CHECKPOINT,
    width: int = 512,
    height: int = 512,
    seed: int | None = None,
) -> dict:
    """Load the checked-in API workflow and inject request-specific inputs."""
    if seed is None:
        seed = int(time.time()) % 2**31

    if not WORKFLOW_PATH.is_file():
        raise FileNotFoundError(f"ComfyUI workflow not found: {WORKFLOW_PATH}")
    with WORKFLOW_PATH.open("r", encoding="utf-8") as workflow_file:
        workflow = deepcopy(json.load(workflow_file))

    required_nodes = {"3", "4", "5", "6", "7", "8", "9", "19", "20"}
    if not required_nodes.issubset(workflow):
        raise RuntimeError(f"Workflow is missing required nodes: {sorted(required_nodes - set(workflow))}")

    workflow["4"]["inputs"]["ckpt_name"] = model_filename or DEFAULT_CHECKPOINT
    workflow["5"]["inputs"]["width"] = width
    workflow["5"]["inputs"]["height"] = height
    workflow["6"]["inputs"]["text"] = f"{enriched_prompt}, {QUALITY_SUFFIX}"
    workflow["7"]["inputs"]["text"] = NEGATIVE_PROMPT
    workflow["3"]["inputs"]["seed"] = seed
    workflow["20"]["inputs"]["seed"] = seed + 1
    workflow["9"]["inputs"]["filename_prefix"] = "inkknits_"
    return workflow


class ComfyUIService:
    """Service layer for ComfyUI image generation."""

    @staticmethod
    def _post(endpoint: str, payload: dict) -> dict:
        url = f"{COMFYUI_BASE_URL}/{endpoint}"
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode())

    @staticmethod
    def _get(endpoint: str) -> dict:
        url = f"{COMFYUI_BASE_URL}/{endpoint}"
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode())

    @staticmethod
    def _wait_for_prompt(prompt_id: str, timeout: int = 300) -> dict | None:
        """Poll ComfyUI /history until the prompt is complete."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                history = ComfyUIService._get(f"history/{prompt_id}")
                if prompt_id in history:
                    return history[prompt_id]
            except Exception:
                pass
            time.sleep(1)
        return None

    @staticmethod
    def _fetch_image_bytes(filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
        params = urllib.parse.urlencode({
            "filename": filename,
            "subfolder": subfolder,
            "type": folder_type,
        })
        url = f"{COMFYUI_BASE_URL}/view?{params}"
        with urllib.request.urlopen(url, timeout=60) as resp:
            return resp.read()

    @staticmethod
    def generate_image(
        enriched_prompt: str,
        save_path: Path,
        model_filename: str | None = DEFAULT_CHECKPOINT,
        width: int = 512,
        height: int = 512,
        seed: int | None = None,
    ) -> str:
        """
        Submit a generation job to ComfyUI, wait for completion, save PNG to disk.
        Returns the absolute path of the saved file.

        Called AFTER OllamaService.enrich_image_prompt() has already run.
        """
        client_id = str(uuid.uuid4())
        workflow = _build_workflow(enriched_prompt, model_filename, width, height, seed)

        # Queue the prompt
        response = ComfyUIService._post("prompt", {
            "prompt": workflow,
            "client_id": client_id,
        })
        prompt_id = response.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"ComfyUI did not return a prompt_id: {response}")

        # Wait for completion
        history_entry = ComfyUIService._wait_for_prompt(prompt_id)
        if not history_entry:
            raise TimeoutError(f"ComfyUI job {prompt_id} timed out")

        # Extract the SaveImage output (checks node 9 first, then auto-detects any output node with images)
        outputs = history_entry.get("outputs", {})
        images = []
        if "9" in outputs and outputs["9"].get("images"):
          images = outputs["9"]["images"]
        else:
          for node_id, node_out in outputs.items():
            if isinstance(node_out, dict) and "images" in node_out and node_out["images"]:
              images = node_out["images"]
              break

        if not images:
          raise RuntimeError(f"ComfyUI returned no images in output nodes: {list(outputs.keys())}")

        image_info = images[0]
        image_bytes = ComfyUIService._fetch_image_bytes(
            filename=image_info["filename"],
            subfolder=image_info.get("subfolder", ""),
            folder_type=image_info.get("type", "output"),
        )

        # Save to SSD
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_bytes(image_bytes)
        return str(save_path)

    @staticmethod
    def is_available() -> bool:
        """Quick health check — returns True if ComfyUI is reachable."""
        try:
            ComfyUIService._get("system_stats")
            return True
        except Exception:
            return False
