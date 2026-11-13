import base64
import json
import unittest
import urllib.error
from unittest.mock import call, patch

import cloudflare_app_benchmark as benchmark


class FakeClock:
    def __init__(self) -> None:
        self.value = 1_800_000_000.0

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


def fake_jwt(expiration: float, suffix: str) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"exp": expiration}).encode("ascii")
    ).decode("ascii").rstrip("=")
    return f"header.{payload}.{suffix}"


class AuthSessionTests(unittest.TestCase):
    def test_reauthenticates_after_controlled_sixty_minute_expiry(self) -> None:
        clock = FakeClock()
        login_tokens = []

        def fake_login(_base: str) -> str:
            token = fake_jwt(clock.value + 3600, str(len(login_tokens)))
            login_tokens.append(token)
            return token

        session = benchmark.AuthSession(
            "http://local", login_fn=fake_login, clock=clock,
            wall_clock=clock, refresh_margin_seconds=0,
        )
        with patch.object(benchmark, "request", return_value=(200, {}, 0)) as mocked_request:
            benchmark.authenticated_request(session, "/health")
            clock.advance(3601)
            status, _, _ = benchmark.authenticated_request(session, "/health")

        self.assertEqual(status, 200)
        self.assertEqual(session.login_count, 2)
        self.assertEqual(mocked_request.call_count, 2)
        self.assertEqual(mocked_request.call_args_list, [
            call("http://local", "/health", login_tokens[0], "GET", None, 60),
            call("http://local", "/health", login_tokens[1], "GET", None, 60),
        ])

    def test_reauthenticates_once_after_explicit_401(self) -> None:
        clock = FakeClock()
        login_tokens = []

        def fake_login(_base: str) -> str:
            token = fake_jwt(clock.value + 3600, str(len(login_tokens)))
            login_tokens.append(token)
            return token

        session = benchmark.AuthSession(
            "http://local", login_fn=fake_login, clock=clock,
            wall_clock=clock, refresh_margin_seconds=0,
        )
        with patch.object(
            benchmark, "request",
            side_effect=[(401, {}, 0), (202, {"task_id": "job-1"}, 12)],
        ) as mocked_request:
            status, payload, _ = benchmark.authenticated_request(
                session, "/ai/jobs", method="POST", body={"job_type": "IMAGE"}
            )

        self.assertEqual(status, 202)
        self.assertEqual(payload["task_id"], "job-1")
        self.assertEqual(session.login_count, 2)
        self.assertEqual(session.unauthorized_retries, 1)
        self.assertEqual(mocked_request.call_count, 2)

    def test_does_not_retry_generation_after_ambiguous_transport_failure(self) -> None:
        clock = FakeClock()

        def fake_login(_base: str) -> str:
            return fake_jwt(clock.value + 3600, "test")

        session = benchmark.AuthSession(
            "http://local", login_fn=fake_login, clock=clock,
            wall_clock=clock, refresh_margin_seconds=0,
        )
        with patch.object(
            benchmark, "request",
            side_effect=urllib.error.URLError("connection lost"),
        ) as mocked_request:
            with self.assertRaises(urllib.error.URLError):
                benchmark.authenticated_request(
                    session, "/ai/jobs", method="POST", body={"job_type": "IMAGE"}
                )

        self.assertEqual(mocked_request.call_count, 1)
        self.assertEqual(session.unauthorized_retries, 0)

    def test_does_not_retry_generation_after_server_error(self) -> None:
        clock = FakeClock()

        def fake_login(_base: str) -> str:
            return fake_jwt(clock.value + 3600, "test")

        session = benchmark.AuthSession(
            "http://local", login_fn=fake_login, clock=clock,
            wall_clock=clock, refresh_margin_seconds=0,
        )
        with patch.object(benchmark, "request", return_value=(503, {}, 0)) as mocked_request:
            status, _, _ = benchmark.authenticated_request(
                session, "/ai/jobs", method="POST", body={"job_type": "IMAGE"}
            )

        self.assertEqual(status, 503)
        self.assertEqual(mocked_request.call_count, 1)

    def test_sanitizes_passwords_and_bearer_tokens(self) -> None:
        with patch.object(benchmark, "PASSWORD", "local-test-password"):
            sanitized = benchmark.sanitize_error(
                "password: local-test-password; Authorization: Bearer eyJheader.eyJpayload.signature"
            )

        self.assertNotIn("local-test-password", sanitized)
        self.assertNotIn("eyJpayload", sanitized)
        self.assertIn("[REDACTED]", sanitized)


if __name__ == "__main__":
    unittest.main()
