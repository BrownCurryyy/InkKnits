import io
import unittest

from fastapi import UploadFile

from backend.app.auth import has_required_roles
from backend.services.storage import StorageService


class HardeningTests(unittest.TestCase):
    def test_has_required_roles_accepts_admin_override(self) -> None:
        self.assertTrue(has_required_roles(["VIEWER", "ADMIN"], ("EDITOR", "MANAGER")))

    def test_has_required_roles_rejects_missing_role(self) -> None:
        self.assertFalse(has_required_roles(["VIEWER"], ("EDITOR", "MANAGER")))

    def test_validate_upload_file_rejects_unsupported_extension(self) -> None:
        upload = UploadFile(
            filename="payload.exe",
            file=io.BytesIO(b"not-an-allowed-file"),
            headers={"content-type": "application/x-msdownload"},
        )

        with self.assertRaises(ValueError):
            StorageService.validate_upload_file(upload)


if __name__ == "__main__":
    unittest.main()
