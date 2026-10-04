"""Persist the successfully deployed image tag in the production env file."""

from __future__ import annotations

import argparse
import os
import re
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

IMAGE_TAG_RE = re.compile(r"[0-9a-f]{40}\Z")


def _replace_bytes(env_file: Path, updated: bytes, file_stat: os.stat_result) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".env.production.", dir=env_file.parent
    )
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(updated)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary_name, stat.S_IMODE(file_stat.st_mode))
        if hasattr(os, "chown"):
            temporary_stat = os.stat(temporary_name)
            if (temporary_stat.st_uid, temporary_stat.st_gid) != (
                file_stat.st_uid,
                file_stat.st_gid,
            ):
                os.chown(temporary_name, file_stat.st_uid, file_stat.st_gid)
        os.replace(temporary_name, env_file)
    except BaseException:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def sync_image_tag(
    env_file: Path,
    tag: str,
    backup_dir: Path,
    verify: Callable[[], None] | None = None,
) -> Path | None:
    """Replace only IMAGE_TAG, preserving other bytes, file mode, and ownership."""

    if not IMAGE_TAG_RE.fullmatch(tag):
        raise ValueError("IMAGE_TAG must be a full lowercase commit SHA")

    original = env_file.read_bytes()
    lines = original.splitlines(keepends=True)
    matches = [
        index for index, line in enumerate(lines) if line.startswith(b"IMAGE_TAG=")
    ]
    if len(matches) != 1:
        raise ValueError(".env.production must contain exactly one IMAGE_TAG line")

    index = matches[0]
    previous = lines[index].rstrip(b"\r\n")
    if previous == f"IMAGE_TAG={tag}".encode("ascii"):
        if verify is not None:
            verify()
        return None

    ending = lines[index][len(previous) :]
    replacement = f"IMAGE_TAG={tag}".encode("ascii") + ending
    updated = b"".join((*lines[:index], replacement, *lines[index + 1 :]))
    file_stat = env_file.stat()

    backup_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
    if os.name == "posix" and stat.S_IMODE(backup_dir.stat().st_mode) != 0o700:
        raise PermissionError("IMAGE_TAG backup directory must have mode 0700")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backup_dir / f"image-tag-{stamp}-{os.getpid()}.txt"
    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(previous + b"\n")
        stream.flush()
        os.fsync(stream.fileno())

    try:
        _replace_bytes(env_file, updated, file_stat)
        if verify is not None:
            verify()
        if env_file.read_bytes() != updated:
            raise RuntimeError("IMAGE_TAG verification failed after replacement")
    except BaseException:
        if env_file.read_bytes() == updated:
            _replace_bytes(env_file, original, file_stat)
        raise

    return backup


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--backup-dir", type=Path, required=True)
    args = parser.parse_args()

    backup = sync_image_tag(args.env_file, args.tag, args.backup_dir)
    if backup is None:
        print("IMAGE_TAG is already current")
    else:
        print(f"IMAGE_TAG synchronized; previous tag saved at {backup}")


if __name__ == "__main__":
    main()
