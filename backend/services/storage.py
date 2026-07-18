import base64
import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile

STORAGE_ROOT = Path("storage")


class StorageService:
    @staticmethod
    def get_asset_directory(organization_id: UUID, project_id: UUID) -> Path:
        """Generates a structured SSD storage path."""
        path = STORAGE_ROOT / f"org_{organization_id}" / f"project_{project_id}" / "assets"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    async def save_upload_file(organization_id: UUID, project_id: UUID, asset_id: UUID, file: UploadFile) -> str:
        """Saves a multipart/form-data UploadFile to the SSD."""
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
