from __future__ import annotations

import csv
import shutil
import subprocess
import threading
import time
from pathlib import Path

try:
    import psutil
except ImportError:
    psutil = None


class ResourceMonitor:
    def __init__(self, interval_seconds: float = 0.25) -> None:
        self.interval_seconds = interval_seconds
        self.samples: list[dict] = []
        self.running = False
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def sample(self) -> dict:
        result = {"timestamp": time.time(), "cpu_percent": None, "ram_percent": None, "ram_used_bytes": None, "gpu_utilization_percent": None, "gpu_memory_used_bytes": None, "gpu_memory_total_bytes": None, "gpu_temperature_celsius": None, "gpu_power_watts": None}
        if psutil is not None:
            result.update({"cpu_percent": psutil.cpu_percent(interval=None), "ram_percent": psutil.virtual_memory().percent, "ram_used_bytes": psutil.virtual_memory().used})
        if shutil.which("nvidia-smi"):
            try:
                output = subprocess.check_output(["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw", "--format=csv,noheader,nounits"], text=True, timeout=2).strip().splitlines()[0].split(",")
                result.update({"gpu_utilization_percent": float(output[0]), "gpu_memory_used_bytes": float(output[1]) * 1024 * 1024, "gpu_memory_total_bytes": float(output[2]) * 1024 * 1024, "gpu_temperature_celsius": float(output[3]), "gpu_power_watts": float(output[4])})
            except (OSError, ValueError, IndexError, subprocess.SubprocessError):
                pass
        self.samples.append(result)
        return result

    def start(self) -> None:
        self.running = True
        self.sample()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._sample_loop, name="inkknits-resource-monitor", daemon=True)
        self._thread.start()

    def _sample_loop(self) -> None:
        while not self._stop_event.wait(self.interval_seconds):
            self.sample()

    def stop(self) -> dict:
        self.running = False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=max(1.0, self.interval_seconds * 4))
            self._thread = None
        self.sample()
        keys = [key for key in self.samples[0] if key != "timestamp"] if self.samples else []
        summary = {"sample_count": len(self.samples)}
        for key in keys:
            values = [sample[key] for sample in self.samples if sample[key] is not None]
            summary[f"{key}_mean"] = sum(values) / len(values) if values else None
            summary[f"{key}_max"] = max(values) if values else None
        return summary

    def write_csv(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fields = list(self.samples[0]) if self.samples else ["timestamp"]
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(self.samples)
