import importlib.util
import json
import os
from contextlib import ExitStack
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from apps.policies.benchmark_prepare import (
    private_json,
    save_context,
    save_source,
    validate_private_root,
)

_EXPIRY_SCRIPT = (
    Path(__file__).resolve().parents[4] / "scripts" / "ai_benchmark_expiry.py"
)
_SPEC = importlib.util.spec_from_file_location(
    "_benchmark_expiry_tests", _EXPIRY_SCRIPT
)
expiry = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(expiry)


class PrivateCorpusFileTests(TestCase):
    def test_private_json_preserves_source_content_and_restricts_file_permissions(self):
        with TemporaryDirectory() as temporary:
            target = Path(temporary) / "source.json"
            value = {"pages": ["Example document text"], "policy_id": "synthetic"}
            private_json(target, value)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), value)
            if os.name != "nt":
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_atomic_write_failure_preserves_previous_artifact(self):
        with TemporaryDirectory() as temporary:
            target = Path(temporary) / "source.json"
            private_json(target, {"version": 1})
            with patch(
                "apps.policies.benchmark_prepare.os.replace",
                side_effect=OSError("fixture"),
            ), self.assertRaises(OSError):
                private_json(target, {"version": 2})
            self.assertEqual(
                json.loads(target.read_text(encoding="utf-8")), {"version": 1}
            )
            self.assertEqual(list(Path(temporary).iterdir()), [target])

    def test_existing_context_cannot_be_changed_on_resume(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            save_context(root, {"prompt": "initial"})
            save_context(root, {"prompt": "initial"})
            with self.assertRaises(SystemExit):
                save_context(root, {"prompt": "changed"})
            self.assertEqual(
                json.loads((root / "context.json").read_text(encoding="utf-8")),
                {"prompt": "initial"},
            )

    def test_interrupted_source_slot_only_accepts_identical_pdf(self):
        with TemporaryDirectory() as temporary:
            slot = Path(temporary) / "c1-1"
            save_source(slot, b"source A")
            save_source(slot, b"source A")
            with self.assertRaises(ValueError):
                save_source(slot, b"source B")
            self.assertEqual((slot / "source.pdf").read_bytes(), b"source A")


class BenchmarkExpiryTests(TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name) / "diagnostics"
        self.base.mkdir()
        self.cron = Path(self.temporary.name) / "cron-entry"
        self.now = 1_800_000_000
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(expiry, "BASE", self.base))
        self.stack.enter_context(patch.object(expiry, "CRON", self.cron))
        self.stack.enter_context(
            patch.object(expiry.time, "time", return_value=self.now)
        )
        self.stack.enter_context(patch("builtins.print"))
        # main() deliberately sets a private umask; restore the test process.
        previous_umask = os.umask(0o077)
        self.addCleanup(os.umask, previous_umask)

    def run_expiry(self, *arguments):
        with patch("sys.argv", ["ai_benchmark_expiry.py", *arguments]):
            expiry.main()

    def make_run(self, name, expires_at=None):
        directory = self.base / name
        directory.mkdir()
        (directory / "source.pdf").write_bytes(b"synthetic fixture")
        if expires_at is not None:
            (directory / "expiry.json").write_text(
                json.dumps({"expires_at": expires_at}), encoding="utf-8"
            )
        return directory

    def test_initialization_sets_exact_seven_day_deadline_and_cron(self):
        self.run_expiry("--initialize", "benchmark-test")
        directory = self.base / "benchmark-test"
        marker = directory / "expiry.json"
        self.assertEqual(
            json.loads(marker.read_text(encoding="utf-8"))["expires_at"],
            self.now + 7 * 86400,
        )
        command = self.cron.read_text(encoding="utf-8")
        self.assertTrue(command.startswith("* * * * * root /usr/bin/python3 "))
        self.assertIn("benchmark_expiry.py", command)
        if os.name != "nt":
            self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
            self.assertEqual(marker.stat().st_mode & 0o777, 0o600)

    def test_initialization_does_not_replace_existing_run_or_cron(self):
        self.cron.write_text("existing cron entry", encoding="utf-8")
        self.run_expiry("--initialize", "benchmark-test")
        with self.assertRaises(FileExistsError):
            self.run_expiry("--initialize", "benchmark-test")
        self.assertEqual(self.cron.read_text(encoding="utf-8"), "existing cron entry")

    def test_initialization_rejects_parent_escape_and_nonbenchmark_name(self):
        for name in (
            "../benchmark-escape",
            "ordinary",
            "benchmark-nested/benchmark-run",
        ):
            with self.subTest(name=name), self.assertRaises(SystemExit):
                self.run_expiry("--initialize", name)
        self.assertEqual(list(self.base.iterdir()), [])

    def test_only_expired_marked_benchmark_directory_is_deleted(self):
        expired = self.make_run("benchmark-expired", self.now - 1)
        future = self.make_run("benchmark-future", self.now + 1)
        unmarked = self.make_run("benchmark-unmarked")
        unrelated = self.make_run("ordinary-directory", self.now - 1)
        self.run_expiry()
        self.assertFalse(expired.exists())
        self.assertTrue(future.exists())
        self.assertTrue(unmarked.exists())
        self.assertTrue(unrelated.exists())

    def test_deadline_is_inclusive_without_waiting_for_next_day(self):
        expired = self.make_run("benchmark-deadline", self.now)
        self.run_expiry()
        self.assertFalse(expired.exists())

    def test_benchmark_named_files_are_never_deleted(self):
        file_path = self.base / "benchmark-file"
        file_path.write_text("preserve", encoding="utf-8")
        self.run_expiry()
        self.assertTrue(file_path.exists())

    def test_symlink_directory_cannot_expand_deletion_scope(self):
        outside = Path(self.temporary.name) / "outside"
        outside.mkdir()
        marker = outside / "expiry.json"
        marker.write_text(json.dumps({"expires_at": self.now - 1}), encoding="utf-8")
        link = self.base / "benchmark-link"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Creating symlinks is not permitted on this platform")
        self.run_expiry()
        self.assertTrue(outside.exists())
        self.assertTrue(marker.exists())
        self.assertTrue(link.is_symlink())

    def test_symlink_marker_does_not_authorize_deletion(self):
        directory = self.make_run("benchmark-linked-marker")
        outside_marker = Path(self.temporary.name) / "expiry.json"
        outside_marker.write_text(
            json.dumps({"expires_at": self.now - 1}), encoding="utf-8"
        )
        try:
            (directory / "expiry.json").symlink_to(outside_marker)
        except (OSError, NotImplementedError):
            self.skipTest("Creating symlinks is not permitted on this platform")
        self.run_expiry()
        self.assertTrue(directory.exists())
        self.assertTrue(outside_marker.exists())

    def test_malformed_markers_do_not_prevent_other_expired_runs_cleanup(self):
        invalid_markers = [
            "broken JSON",
            "{}",
            "[]",
            json.dumps({"expires_at": "yesterday"}),
            json.dumps({"expires_at": True}),
            json.dumps({"expires_at": -1}),
            json.dumps({"expires_at": float("nan")}),
            json.dumps({"expires_at": float("inf")}),
            json.dumps({"expires_at": 10**400}),
            json.dumps({"expires_at": self.now + 8 * 86400}),
        ]
        invalid_runs = []
        for index, content in enumerate(invalid_markers):
            directory = self.make_run(f"benchmark-invalid-{index}")
            (directory / "expiry.json").write_text(content, encoding="utf-8")
            invalid_runs.append(directory)
        expired = self.make_run("benchmark-expired-after-invalid", self.now - 1)
        self.run_expiry()
        self.assertFalse(expired.exists())
        self.assertTrue(all(directory.exists() for directory in invalid_runs))

    def test_private_root_requires_valid_live_expiry_before_preparation(self):
        root = self.make_run("benchmark-prepare")
        with self.assertRaises(SystemExit):
            validate_private_root(root, self.base)
        marker = root / "expiry.json"
        for value in (self.now, -1, True, float("nan"), self.now + 8 * 86400, 10**400):
            marker.write_text(json.dumps({"expires_at": value}), encoding="utf-8")
            with self.subTest(value=value), self.assertRaises(SystemExit):
                validate_private_root(root, self.base)
        marker.write_text(json.dumps({"expires_at": self.now + 1}), encoding="utf-8")
        self.assertEqual(validate_private_root(root, self.base), root.resolve())

    def test_corpus_cannot_change_after_freeze_or_accounting(self):
        for blocker in ("ledger.json", "ledger.json.lock", "frozen.json"):
            with self.subTest(blocker=blocker):
                root = self.make_run("benchmark-" + blocker, self.now + 1)
                (root / blocker).write_text("{}", encoding="utf-8")
                with self.assertRaises(SystemExit):
                    validate_private_root(root, self.base)

    def test_missing_root_does_not_get_created_implicitly(self):
        root = self.base / "benchmark-not-initialized"
        with self.assertRaises(SystemExit):
            validate_private_root(root, self.base)
        self.assertFalse(root.exists())
