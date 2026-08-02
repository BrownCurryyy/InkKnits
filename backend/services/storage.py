import base64
import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", Path(__file__).resolve().parents[2] / "storage")).resolve()
ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".txt", ".md", ".json", ".pdf", ".zip"}
MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024


class StorageService:
    @staticmethod
    def get_asset_directory(organization_id: UUID, project_id: UUID) -> Path:
        """Generates a structured SSD storage path."""
        path = STORAGE_ROOT / f"org_{organization_id}" / f"project_{project_id}" / "assets"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def validate_upload_file(file: UploadFile, allowed_extensions: set[str] | None = None) -> None:
        """Reject unsupported or unsafe uploads before they are written to disk."""
        if file.filename is None:
            raise ValueError("Upload requires a filename")

        extension = Path(file.filename).suffix.lower()
        allowed = allowed_extensions or ALLOWED_UPLOAD_EXTENSIONS
        if extension not in allowed:
            raise ValueError(f"Unsupported file extension '{extension}'. Allowed: {', '.join(sorted(allowed))}")

        if file.file.seekable():
            current_position = file.file.tell()
            file.file.seek(0, os.SEEK_END)
            size = file.file.tell()
            file.file.seek(current_position)
            if size > MAX_UPLOAD_SIZE_BYTES:
                raise ValueError(f"Upload exceeds the maximum size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB")

    @staticmethod
    async def save_upload_file(organization_id: UUID, project_id: UUID, asset_id: UUID, file: UploadFile) -> str:
        """Saves a multipart/form-data UploadFile to the SSD."""
        StorageService.validate_upload_file(file)
        directory = StorageService.get_asset_directory(organization_id, project_id)

        # Extract extension or default to .bin
        ext = os.path.splitext(file.filename)[1] if file.filename else ".bin"
        file_path = directory / f"{asset_id}{ext}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return str(file_path)

    @staticmethod
    def read_file_as_base64(file_path: str) -> str:
        """Reads a file from SSD and encodes it to base64."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
            
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        return encoded

    @staticmethod
    def delete_file(file_path: str) -> bool:
        """Deletes a file from the SSD if it exists."""
        if not file_path:
            return False
            
        path = Path(file_path)
        if path.exists():
            path.unlink()
            return True
        return False
