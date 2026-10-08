#!/usr/bin/env python3
"""Verify that the zipped ButtonPost Runner works without the source repository.

This tests the *packaged* runtime and dependencies, not only the source tree.
Platform login + Chrome UI still require an actual user-device acceptance test.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zipfile import ZipFile


def choose_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def get_response(url: str, *, method: str = "GET", headers=None, data=None):
    request = Request(url, method=method, headers=headers or {}, data=data)
    try:
        with urlopen(request, timeout=2) as response:
            return response.status, response.read(), response.headers
    except HTTPError as err:
        return err.code, err.read(), err.headers


def main(target: str):
    archive_path = Path("dist") / f"ButtonPost-Runner-{target}.zip"
    if not archive_path.is_file():
        raise SystemExit(f"Missing package {archive_path}")
    token = "portable-runner-smoke-token-" + "a" * 32

    with tempfile.TemporaryDirectory(prefix="buttonpost-standalone-smoke-") as tmp:
        with ZipFile(archive_path) as archive:
            node_name = "node.exe" if target.startswith("windows") else "node"
            bin_name = f"ButtonPost-Runner/runtime/{node_name}"
            runner_name = "ButtonPost-Runner/runner/server.mjs"
            if bin_name not in archive.namelist() or runner_name not in archive.namelist():
                raise AssertionError("Missing runtime or server in packaged ZIP")
            if not target.startswith("windows"):
                mode = archive.getinfo(bin_name).external_attr >> 16
                if not mode & 0o111:
                    raise AssertionError("Packaged Node runtime is not executable")
            archive.extractall(tmp)

        extracted = Path(tmp) / "ButtonPost-Runner"
        node = extracted / "runtime" / node_name
        if not target.startswith("windows"):
            node.chmod(node.stat().st_mode | 0o111)
        server = extracted / "runner/server.mjs"
        port = choose_port()
        env = os.environ.copy()
        env.pop("NODE_PATH", None)
        env["BUTTONPOST_RUNNER_HOST"] = "127.0.0.1"
        env["BUTTONPOST_RUNNER_PORT"] = str(port)
        env["BUTTONPOST_RUNNER_TOKEN"] = token

        proc = subprocess.Popen(
            [str(node), str(server)],
            cwd=tmp,  # Crucial: the application must not depend on repo files.
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        try:
            base = f"http://127.0.0.1:{port}"
            ready = False
            for _ in range(150):
                if proc.poll() is not None:
                    raise AssertionError(f"Bundled Runner exited with {proc.returncode}")
                try:
                    status, body, response_headers = get_response(
                        base + "/health", headers={"Origin": "https://buttonpost.app"}
                    )
                    if status == 200 and b"ButtonPost Local Runner" in body:
                        assert response_headers.get("Access-Control-Allow-Origin") == "https://buttonpost.app"
                        ready = True
                        break
                except (URLError, TimeoutError):
                    pass
                time.sleep(0.1)
            if not ready:
                raise AssertionError("Bundled Runner did not start on localhost")

            status, _, _ = get_response(base + "/v1/echo", method="POST", data=b"{}")
            assert status == 401, f"Unauthenticated request unexpectedly accepted ({status})"
            status, body, _ = get_response(
                base + "/v1/echo",
                method="POST",
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                data=b'{"title":"Portable smoke test","content":""}',
            )
            assert status == 200 and b'"ok":true' in body, f"Authenticated request failed ({status})"
            status, _, _ = get_response(
                base + "/health", headers={"Origin": "https://untrusted.example"}
            )
            assert status == 403, f"Untrusted site unexpectedly accepted ({status})"
            print(f"PASS {target}: zipped Node + dependencies start outside repo; CORS/auth checked")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
            if proc.returncode not in (0, -15, 1, 143):
                print(f"Runner exited with code {proc.returncode} after smoke test")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=["macos-arm64", "macos-x64", "windows-x64"], required=True)
    args = parser.parse_args()
    main(args.target)
