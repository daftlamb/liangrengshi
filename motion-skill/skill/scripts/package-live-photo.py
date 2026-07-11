#!/usr/bin/env python3
"""Package rendered motion-card assets through the shared Live Photo helper."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("jpg", type=Path)
    parser.add_argument("mov", type=Path)
    parser.add_argument("--platform", choices=("xiaohongshu", "wechat"), default="xiaohongshu")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    jpg = args.jpg.expanduser().resolve()
    mov = args.mov.expanduser().resolve()
    if not jpg.is_file() or jpg.suffix.lower() not in {".jpg", ".jpeg"}:
        raise SystemExit(f"missing JPG: {jpg}")
    if not mov.is_file() or mov.suffix.lower() != ".mov":
        raise SystemExit(f"missing MOV: {mov}")

    helper = Path.home() / ".codex/skills/guizang-social-card-skill/scripts/package-live-photo.py"
    if not helper.is_file():
        raise SystemExit(f"missing shared Live Photo helper: {helper}")
    command = [
        "uvx", "--from", "makelive==0.7.0", "python", str(helper), str(jpg), str(mov)
    ]
    payload = {
        "ok": True,
        "platform": args.platform,
        "duration": 5 if args.platform == "xiaohongshu" else 3,
        "command": command,
    }
    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False))
        return
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
