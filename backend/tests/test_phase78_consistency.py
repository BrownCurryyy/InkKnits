import unittest

from backend.models.ai_job import AIJob


class Phase78ConsistencyTests(unittest.TestCase):
    def test_ai_job_model_supports_tenant_and_station_context(self) -> None:
        self.assertTrue(hasattr(AIJob, "organization_id"))
        self.assertTrue(hasattr(AIJob, "station_id"))


if __name__ == "__main__":
    unittest.main()
