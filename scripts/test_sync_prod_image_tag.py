"""Regression tests for the production IMAGE_TAG update."""

from __future__ import annotations

import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.sync_prod_image_tag import sync_image_tag

OLD_TAG = "b6abc58251bc215fae25dc78904e2d7230e93571"
NEW_TAG = "72462e76f15a0171c83add0f214c41d406e79668"


class SyncImageTagTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.env_file = self.root / ".env.production"
        self.backup_dir = self.root / "backups"
        self.original = (
            b"OTHER_CONFIG=unchanged\r\n"
            + f"IMAGE_TAG={OLD_TAG}\r\n".encode("ascii")
            + b"POLICY_RECOGNITION_MODEL=google/gemini-3.1-pro-preview\r\n"
        )
        self.env_file.write_bytes(self.original)
        self.env_file.chmod(0o600)

    def test_updates_only_tag_and_backs_up_previous_line(self) -> None:
        backup = sync_image_tag(self.env_file, NEW_TAG, self.backup_dir)

        self.assertIsNotNone(backup)
        self.assertEqual(
            self.env_file.read_bytes(),
            self.original.replace(OLD_TAG.encode("ascii"), NEW_TAG.encode("ascii")),
        )
        self.assertEqual(backup.read_bytes(), f"IMAGE_TAG={OLD_TAG}\n".encode("ascii"))
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(self.env_file.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(self.backup_dir.stat().st_mode), 0o700)

    def test_same_tag_is_idempotent(self) -> None:
        first_backup = sync_image_tag(self.env_file, NEW_TAG, self.backup_dir)

        self.assertIsNone(sync_image_tag(self.env_file, NEW_TAG, self.backup_dir))
        self.assertEqual(list(self.backup_dir.iterdir()), [first_backup])

    def test_missing_duplicate_and_invalid_tag_fail_without_changes(self) -> None:
        for contents, tag in (
            (b"OTHER=value\n", NEW_TAG),
            (self.original + b"IMAGE_TAG=another\n", NEW_TAG),
            (self.original, "not-a-commit"),
        ):
            with self.subTest(contents=contents, tag=tag):
                self.env_file.write_bytes(contents)
                with self.assertRaises(ValueError):
                    sync_image_tag(self.env_file, tag, self.backup_dir)
                self.assertEqual(self.env_file.read_bytes(), contents)
        self.assertFalse(self.backup_dir.exists())

    @unittest.skipUnless(os.name == "posix", "POSIX permissions are required")
    def test_rejects_insecure_backup_directory(self) -> None:
        self.backup_dir.mkdir(mode=0o755)

        with self.assertRaises(PermissionError):
            sync_image_tag(self.env_file, NEW_TAG, self.backup_dir)

        self.assertEqual(self.env_file.read_bytes(), self.original)

    def test_failed_atomic_replace_preserves_env_file(self) -> None:
        with patch(
            "scripts.sync_prod_image_tag.os.replace", side_effect=OSError("failed")
        ):
            with self.assertRaises(OSError):
                sync_image_tag(self.env_file, NEW_TAG, self.backup_dir)

        self.assertEqual(self.env_file.read_bytes(), self.original)
        self.assertEqual(len(list(self.backup_dir.iterdir())), 1)

    def test_failed_post_update_verification_restores_previous_env(self) -> None:
        def fail_verification() -> None:
            self.assertIn(NEW_TAG.encode("ascii"), self.env_file.read_bytes())
            raise RuntimeError("Compose mismatch")

        with self.assertRaisesRegex(RuntimeError, "Compose mismatch"):
            sync_image_tag(
                self.env_file,
                NEW_TAG,
                self.backup_dir,
                verify=fail_verification,
            )

        self.assertEqual(self.env_file.read_bytes(), self.original)
        self.assertEqual(len(list(self.backup_dir.iterdir())), 1)
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(self.env_file.stat().st_mode), 0o600)


if __name__ == "__main__":
    unittest.main()
