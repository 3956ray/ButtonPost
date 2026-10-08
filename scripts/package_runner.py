#!/usr/bin/env python3
"""Build a portable ButtonPost Runner ZIP for the current OS.

Requires Node 22 and prior `npm install --prefix runner --omit=dev`.
Package output is intentionally unsigned; release only after platform smoke tests.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def package(target: str) -> Path:
    node_path = shutil.which("node")
    if not node_path:
        raise SystemExit("Node executable not found on build host")

    source = ROOT / "runner"
    if not (source / "node_modules" / "patchright").exists():
        raise SystemExit("Run npm install --prefix runner --omit=dev before packaging")

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    output = dist / f"ButtonPost-Runner-{target}.zip"

    with tempfile.TemporaryDirectory(prefix="buttonpost-package-") as tmp:
        app = Path(tmp) / "ButtonPost-Runner"
        (app / "runtime").mkdir(parents=True)
        def safe_ignore(folder: str, names: list[str]) -> set[str]:
            ignored = set(
                shutil.ignore_patterns("*.test.mjs", ".DS_Store", "package-lock.json")(folder, names)
            )
            for name in names:
                entry = Path(folder) / name
                # npm may create self-referential workspace links/junctions,
                # particularly node_modules/buttonpost on Windows.
                if entry.is_symlink() or entry.is_junction():
                    ignored.add(name)
                if Path(folder).name == "node_modules" and name in {"buttonpost", ".bin"}:
                    ignored.add(name)
            return ignored

        shutil.copytree(
            source,
            app / "runner",
            ignore=safe_ignore,
        )
        node_binary = app / "runtime" / ("node.exe" if target.startswith("windows") else "node")
        shutil.copy2(node_path, node_binary)
        if not target.startswith("windows"):
            node_binary.chmod(0o755)

        # The Node distribution license must accompany the bundled runtime.
        node = Path(node_path).resolve()
        license_candidates = [
            node.parent.parent / "LICENSE",
            node.parent / "LICENSE",
            node.parent.parent / "LICENSE.txt",
            node.parent / "LICENSE.txt",
        ]
        node_license = next((f for f in license_candidates if f.is_file()), None)
        if not node_license:
            raise SystemExit("Could not locate bundled Node.js LICENSE; refusing to distribute")
        shutil.copy2(node_license, app / "runtime" / "NODE_LICENSE.txt")
        shutil.copy2(ROOT / "LICENSE", app / "BUTTONPOST_LICENSE.txt")

        if target.startswith("windows"):
            (app / "Start-ButtonPost-Runner.cmd").write_text(
                '@echo off\r\n'
                'cd /d "%~dp0"\r\n'
                '"%~dp0runtime\\node.exe" "%~dp0runner\\launch.mjs"\r\n'
                'echo.\r\n'
                'echo ButtonPost Runner stopped.\r\n'
                'pause\r\n',
                encoding="utf-8",
            )
        else:
            launcher = app / "Start-ButtonPost-Runner.command"
            launcher.write_text(
                '#!/bin/sh\n'
                'cd "$(dirname "$0")" || exit 1\n'
                '"./runtime/node" "./runner/launch.mjs"\n'
                'status=$?\n'
                'if [ "$status" -ne 0 ]; then echo "Runner stopped with error $status"; read -r _; fi\n'
                'exit "$status"\n',
                encoding="utf-8",
            )
            launcher.chmod(0o755)

        (app / "READ-ME-FIRST.txt").write_text(
            "ButtonPost Runner - optional local publishing helper\n\n"
            "1. Install Google Chrome if you have not already.\n"
            "2. Double-click Start-ButtonPost-Runner in this folder.\n"
            "3. On first start, ButtonPost opens in your browser and pairs automatically.\n"
            "4. Leave the Runner window open while publishing to local platforms.\n"
            "5. X and DEV do not need this helper.\n\n"
            "Your browser sessions and private runner token are stored under ~/.buttonpost\n"
            "Documentation: https://github.com/3956ray/ButtonPost/blob/main/docs/runner-install.md\n"
            "This community beta is unsigned and is not yet a notarized installer.\n",
            encoding="utf-8",
        )

        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file in sorted(app.rglob("*")):
                if not file.is_file():
                    continue
                info = zipfile.ZipInfo.from_file(file, arcname=str(file.relative_to(Path(tmp))))
                with file.open("rb") as handle:
                    archive.writestr(info, handle.read(), compress_type=zipfile.ZIP_DEFLATED)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (dist / (output.name + ".sha256")).write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(f"Packaged {output}, sha256={digest}")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=["macos-arm64", "macos-x64", "windows-x64"], required=True)
    args = parser.parse_args()
    package(args.target)
