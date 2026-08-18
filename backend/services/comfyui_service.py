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
from pathlib import Path

COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")

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
    model_filename: str = "epiCRealism.safetensors",
    width: int = 512,
    height: int = 512,
    seed: int | None = None,
) -> dict:
    """
    Build the ComfyUI API workflow JSON for the dual-KSampler + 4x upscaler pipeline.

    Node layout:
      4 — CheckpointLoaderSimple (model)
      6 — CLIPTextEncode (positive prompt)
      7 — CLIPTextEncode (negative prompt)
      5 — EmptyLatentImage
      3 — KSampler 1 (base pass, low denoise ~0.6)
     10 — KSampler 2 (refine pass, high denoise ~0.9)
      8 — VAEDecode
     11 — UpscaleModelLoader (4x model)
     12 — ImageUpscaleWithModel
      9 — SaveImage
    """
    if seed is None:
        seed = int(time.time()) % 2**31

    positive_text = f"{enriched_prompt}, {QUALITY_SUFFIX}"

    return {
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": model_filename},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": positive_text,
                "clip": ["4", 1],
            },
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": NEGATIVE_PROMPT,
                "clip": ["4", 1],
            },
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1,
            },
        },
        # KSampler 1 — base generation pass
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.6,
            },
        },
        # KSampler 2 — high-denoise refine pass
        "10": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["3", 0],
                "seed": seed + 1,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.9,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["10", 0],
                "vae": ["4", 2],
            },
        },
        # 4x Upscaler
        "11": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4x-UltraSharp.pth"},
        },
        "12": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {
                "upscale_model": ["11", 0],
                "image": ["8", 0],
            },
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["12", 0],
                "filename_prefix": "inkknits_",
            },
        },
    }


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
        model_filename: str = "epiCRealism.safetensors",
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
