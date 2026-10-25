"""Smoke-test the packaged MCP entrypoint and OAuth discovery without live data."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path


def request(url: str, *, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


@contextmanager
def server(application: str):
    candidates = (
        Path.cwd(),
        Path(__file__).resolve().parent.parent / "backend",
        Path(__file__).resolve().parent,
    )
    backend_dir = next(
        (path for path in candidates if (path / "config/asgi.py").is_file()), None
    )
    if backend_dir is None:
        raise RuntimeError("Run this script from the backend image or CRM checkout.")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            application,
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=os.environ.copy(),
        cwd=backend_dir,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"{application} exited before becoming healthy")
            try:
                if request(f"{base_url}/health/")[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.2)
        else:
            raise RuntimeError(f"{application} did not become healthy")
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def main() -> int:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.test_settings")
    resource = os.environ.setdefault("MCP_PUBLIC_URL", "https://zoom78.com/mcp")
    issuer = os.environ.setdefault("MCP_OAUTH_ISSUER", "https://zoom78.com")
    with server("config.asgi:application") as backend_url:
        status, _, raw = request(
            f"{backend_url}/.well-known/oauth-authorization-server"
        )
        assert status == 200, "OAuth authorization metadata is unavailable"
        authorization = json.loads(raw)
        assert authorization["issuer"] == issuer, "OAuth issuer mismatch"
        assert "S256" in authorization["code_challenge_methods_supported"]
        assert "authorization_code" in authorization["grant_types_supported"]
        for path in (
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-protected-resource/mcp",
        ):
            status, _, raw = request(f"{backend_url}{path}")
            assert status == 200, "OAuth protected resource metadata is unavailable"
            metadata = json.loads(raw)
            assert metadata["resource"] == resource, "MCP resource mismatch"
            assert issuer in metadata["authorization_servers"]
    with server("apps.mcp_connector.server:application") as mcp_url:
        status, headers, _ = request(
            f"{mcp_url}/mcp",
            payload={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "crm-ci-smoke", "version": "1.0"},
                },
            },
        )
        assert status == 401, "MCP must reject unauthenticated initialization"
        assert "resource_metadata=" in headers.get(
            "WWW-Authenticate", ""
        ), "MCP OAuth discovery challenge is missing"
    print(
        "MCP runtime health, OAuth discovery and unauthenticated access checks passed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
