from unittest.mock import patch

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.services import (
    ClientMergeService,
    ClientSimilarityService,
    normalize_client_name,
)
from apps.clients.views import ClientViewSet
from apps.common.drive import DriveError
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.policies.models import Policy
from apps.users.models import AuditLog
from django.contrib.auth.models import User
from django.db import ProgrammingError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate


class ClientOwnershipTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(username="owner")
        self.other_user = User.objects.create_user(username="other")

    def test_authenticated_user_query_returns_all_clients(self):
        client_owned = Client.objects.create(name="Owned", created_by=self.user)
        client_for_deal = Client.objects.create(name="Deal client")
        Deal.objects.create(title="Deal", client=client_for_deal, seller=self.user)
        client_other = Client.objects.create(
            name="Other client", created_by=self.other_user
        )

        request = self.factory.get("/clients/")
        force_authenticate(request, user=self.user)
        viewset = ClientViewSet()
        viewset.request = request
        queryset = viewset.get_queryset()

        self.assertIn(client_owned, queryset)
        self.assertIn(client_for_deal, queryset)
        self.assertIn(client_other, queryset)

    def test_perform_create_sets_created_by(self):
        request = self.factory.post("/clients/", {"name": "New"})
        force_authenticate(request, user=self.user)
        serializer = ClientSerializer(data={"name": "New client"})
        serializer.is_valid(raise_exception=True)

        viewset = ClientViewSet()
        viewset.request = request
        viewset.perform_create(serializer)

        self.assertEqual(serializer.instance.created_by, self.user)

    def test_serializer_allows_null_email(self):
        serializer = ClientSerializer(data={"name": "No email", "email": None})
        self.assertTrue(serializer.is_valid())
        client = serializer.save(created_by=self.user)
        self.assertIsNone(client.email)

    def test_client_defaults_to_not_counterparty(self):
        client = Client.objects.create(name="Regular client", created_by=self.user)
        self.assertFalse(client.is_counterparty)

    def test_owner_can_modify(self):
        client = Client.objects.create(name="Owned", created_by=self.user)
        viewset = ClientViewSet()

        self.assertTrue(viewset._can_modify(self.user, client))
        self.assertFalse(viewset._can_modify(self.other_user, client))


class ClientMergeServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner")
        self.target = Client.objects.create(
            name="Иванов Иван Иванович",
            phone="+79990000000",
            email="target@example.com",
            created_by=self.owner,
        )
        self.source = Client.objects.create(
            name="иванов иван",
            phone="+7 (999) 111-22-33",
            email="source@example.com",
            created_by=self.owner,
        )
        self.source_deal = Deal.objects.create(
            title="Source deal",
            client=self.source,
            seller=self.owner,
            status="open",
            stage_name="initial",
        )
        self.source_policy = Policy.objects.create(
            number="PL-001",
            deal=self.source_deal,
            client=self.source,
            insured_client=self.source,
        )

    def test_merge_moves_soft_deleted_records_when_include_deleted_true(self):
        self.source_deal.delete()
        self.source_policy.delete()
        service = ClientMergeService(
            target_client=self.target,
            source_clients=[self.source],
            include_deleted=True,
            field_overrides={"name": "Иванов Иван Иванович"},
        )
        result = service.merge()

        moved_deal = Deal.objects.with_deleted().get(pk=self.source_deal.pk)
        moved_policy = Policy.objects.with_deleted().get(pk=self.source_policy.pk)
        self.assertEqual(moved_deal.client_id, self.target.id)
        self.assertEqual(moved_policy.client_id, self.target.id)
        self.assertEqual(moved_policy.insured_client_id, self.target.id)
        self.assertEqual(result["moved_counts"]["deals"], 1)
        self.assertEqual(result["moved_counts"]["policies"], 1)

    def test_merge_aborts_on_drive_error_before_db_changes(self):
        original_name = self.target.name
        with (
            patch("apps.clients.services.is_drive_oauth_configured", return_value=True),
            patch(
                "apps.clients.services.ensure_client_folder",
                side_effect=DriveError("Drive unavailable"),
            ),
        ):
            with self.assertRaises(DriveError):
                ClientMergeService(
                    target_client=self.target,
                    source_clients=[self.source],
                    include_deleted=True,
                    field_overrides={"name": "Новое имя"},
                ).merge()

        self.target.refresh_from_db()
        self.source_deal.refresh_from_db()
        self.assertEqual(self.target.name, original_name)
        self.assertEqual(self.source_deal.client_id, self.source.id)

    def test_merge_continues_when_source_drive_folder_delete_fails(self):
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        with (
            patch("apps.clients.services.is_drive_oauth_configured", return_value=True),
            patch(
                "apps.clients.services.ensure_client_folder",
                return_value=self.target.drive_folder_id,
            ),
            patch("apps.clients.services.ensure_deal_folder"),
            patch("apps.clients.services.move_drive_folder_contents"),
            patch(
                "apps.clients.services.delete_drive_folder",
                side_effect=DriveError("insufficient permissions"),
            ),
        ):
            result = ClientMergeService(
                target_client=self.target,
                source_clients=[self.source],
                include_deleted=True,
                field_overrides={"name": "Иванов Иван Иванович"},
            ).merge()

        moved_deal = Deal.objects.with_deleted().get(pk=self.source_deal.pk)
        moved_policy = Policy.objects.with_deleted().get(pk=self.source_policy.pk)
        deleted_source = Client.objects.with_deleted().get(pk=self.source.pk)
        self.assertEqual(moved_deal.client_id, self.target.id)
        self.assertEqual(moved_policy.client_id, self.target.id)
        self.assertEqual(moved_policy.insured_client_id, self.target.id)
        self.assertIsNotNone(deleted_source.deleted_at)
        self.assertEqual(result["merged_client_ids"], [str(self.source.id)])
        self.assertIn("Содержимое Drive перенесено", " ".join(result["warnings"]))

    def test_merge_aborts_when_drive_contents_move_fails(self):
        original_name = self.target.name
        self.target.drive_folder_id = "target-folder"
        self.target.save(update_fields=["drive_folder_id"])
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        with (
            patch("apps.clients.services.is_drive_oauth_configured", return_value=True),
            patch(
                "apps.clients.services.ensure_client_folder",
                return_value=self.target.drive_folder_id,
            ),
            patch("apps.clients.services.ensure_deal_folder"),
            patch(
                "apps.clients.services.move_drive_folder_contents",
                side_effect=DriveError("move failed"),
            ),
            patch("apps.clients.services.delete_drive_folder") as delete_drive_folder,
        ):
            with self.assertRaises(DriveError):
                ClientMergeService(
                    target_client=self.target,
                    source_clients=[self.source],
                    include_deleted=True,
                    field_overrides={"name": "Новое имя"},
                ).merge()

        self.target.refresh_from_db()
        self.source_deal.refresh_from_db()
        self.source_policy.refresh_from_db()
        self.source.refresh_from_db()
        self.assertEqual(self.target.name, original_name)
        self.assertEqual(self.source_deal.client_id, self.source.id)
        self.assertEqual(self.source_policy.client_id, self.source.id)
        self.assertIsNone(self.source.deleted_at)
        delete_drive_folder.assert_not_called()

    def test_merge_skips_drive_when_oauth_is_not_configured(self):
        self.source.drive_folder_id = "source-folder"
        self.source.save(update_fields=["drive_folder_id"])

        with (
            patch(
                "apps.clients.services.is_drive_oauth_configured", return_value=False
            ),
            patch("apps.clients.services.ensure_client_folder") as ensure_client_folder,
            patch("apps.clients.services.move_drive_folder_contents") as move_contents,
            patch("apps.clients.services.delete_drive_folder") as delete_drive_folder,
        ):
            result = ClientMergeService(
                target_client=self.target,
                source_clients=[self.source],
                include_deleted=True,
                field_overrides={"name": "Иванов Иван Иванович"},
            ).merge()

        moved_deal = Deal.objects.with_deleted().get(pk=self.source_deal.pk)
        self.assertEqual(moved_deal.client_id, self.target.id)
        self.assertEqual(result["warnings"], [])
        ensure_client_folder.assert_not_called()
        move_contents.assert_not_called()
        delete_drive_folder.assert_not_called()

    def test_merge_preview_uses_longest_name_by_default(self):
        target = Client.objects.create(name="Зотова Марина", created_by=self.owner)
        source = Client.objects.create(
            name="Зотова Марина Николаевна",
            created_by=self.owner,
        )

        preview = ClientMergeService(
            target_client=target,
            source_clients=[source],
        ).build_preview()

        self.assertEqual(
            preview["canonical_profile"]["name"],
            "Зотова Марина Николаевна",
        )

    def test_merge_preview_keeps_target_name_when_lengths_match(self):
        target = Client.objects.create(name="Петров Анна", created_by=self.owner)
        source = Client.objects.create(name="Иванов Олег", created_by=self.owner)

        preview = ClientMergeService(
            target_client=target,
            source_clients=[source],
        ).build_preview()

        self.assertEqual(preview["canonical_profile"]["name"], "Петров Анна")

    def test_merge_preview_deduplicates_phone_formats_and_keeps_alternatives_in_notes(
        self,
    ):
        target = Client.objects.create(
            name="Зотова Марина",
            phone="+7 926 569-34-60",
            email="target@example.com",
            notes="Основная заметка",
            created_by=self.owner,
        )
        same_phone_source = Client.objects.create(
            name="Зотова Марина Николаевна",
            phone="+79265693460",
            email="target@example.com",
            created_by=self.owner,
        )
        alternative_source = Client.objects.create(
            name="Зотова М.",
            phone="8 (926) 000-11-22",
            email="source@example.com",
            created_by=self.owner,
        )

        preview = ClientMergeService(
            target_client=target,
            source_clients=[same_phone_source, alternative_source],
        ).build_preview()

        canonical_profile = preview["canonical_profile"]
        self.assertEqual(canonical_profile["phone"], "+7 926 569-34-60")
        self.assertEqual(canonical_profile["email"], "target@example.com")
        self.assertEqual(
            canonical_profile["candidates"]["phones"],
            ["+7 926 569-34-60", "8 (926) 000-11-22"],
        )
        self.assertIn("Телефоны у дублей отличаются", " ".join(preview["warnings"]))
        self.assertNotIn("+79265693460", canonical_profile["notes"])
        self.assertIn("Основная заметка", canonical_profile["notes"])
        self.assertIn("8 (926) 000-11-22", canonical_profile["notes"])
        self.assertIn("source@example.com", canonical_profile["notes"])

    def test_merge_preview_does_not_warn_for_same_phone_in_different_formats(self):
        target = Client.objects.create(
            name="Зотова Марина",
            phone="+7 926 569-34-60",
            created_by=self.owner,
        )
        source = Client.objects.create(
            name="Зотова Марина Николаевна",
            phone="8 (926) 569-34-60",
            created_by=self.owner,
        )

        preview = ClientMergeService(
            target_client=target,
            source_clients=[source],
        ).build_preview()

        self.assertEqual(
            preview["canonical_profile"]["candidates"]["phones"],
            ["+7 926 569-34-60"],
        )
        self.assertNotIn("Телефоны у дублей отличаются", " ".join(preview["warnings"]))

    def test_merge_preview_uses_source_contact_when_target_contact_is_empty(self):
        target = Client.objects.create(
            name="Зотова Марина",
            phone="",
            email=None,
            created_by=self.owner,
        )
        source = Client.objects.create(
            name="Зотова Марина Николаевна",
            phone="+7 919 774 8683",
            email="zotovamarina90@yandex.ru",
            created_by=self.owner,
        )

        preview = ClientMergeService(
            target_client=target,
            source_clients=[source],
        ).build_preview()

        canonical_profile = preview["canonical_profile"]
        self.assertEqual(canonical_profile["phone"], "+7 919 774 8683")
        self.assertEqual(canonical_profile["email"], "zotovamarina90@yandex.ru")
        self.assertNotIn("zotovamarina90@yandex.ru", canonical_profile["notes"])


class ClientMergeAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="owner", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.target = Client.objects.create(name="Иванов Иван", created_by=self.owner)
        self.source = Client.objects.create(name="иванов ИВАН", created_by=self.owner)
        self.source_deal = Deal.objects.create(
            title="Source deal",
            client=self.source,
            seller=self.owner,
            status="open",
            stage_name="initial",
        )
        self.source_policy = Policy.objects.create(
            number="PL-API-001",
            deal=self.source_deal,
            client=self.source,
            insured_client=self.source,
        )
        self.authenticate(self.owner)

    def test_merge_preview_returns_counts_and_warnings(self):
        response = self.api_client.post(
            "/api/v1/clients/merge/preview/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["moved_counts"]["deals"], 1)
        self.assertEqual(response.data["moved_counts"]["policies_unique"], 1)
        self.assertIn("warnings", response.data)
        self.assertIsInstance(response.data["warnings"], list)

    def test_merge_applies_field_overrides(self):
        response = self.api_client.post(
            "/api/v1/clients/merge/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
                "field_overrides": {
                    "name": "Иванов Иван Иванович",
                    "phone": "+79990001122",
                    "email": "merged@example.com",
                    "notes": "merged-note",
                },
                "preview_snapshot_id": "snap-1",
                "include_deleted": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.name, "Иванов Иван Иванович")
        self.assertEqual(self.target.phone, "+79990001122")
        self.assertEqual(self.target.email, "merged@example.com")
        self.assertEqual(self.target.notes, "merged-note")

    def test_merge_preview_requires_permissions(self):
        self.authenticate(self.other)
        response = self.api_client.post(
            "/api/v1/clients/merge/preview/",
            {
                "target_client_id": str(self.target.id),
                "source_client_ids": [str(self.source.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_create_client_persists_counterparty_flag(self):
        response = self.api_client.post(
            "/api/v1/clients/",
            {
                "name": "Контрагент",
                "is_counterparty": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = Client.objects.get(id=response.data["id"])
        self.assertTrue(created.is_counterparty)
        self.assertTrue(response.data["is_counterparty"])

    def test_update_client_returns_counterparty_flag(self):
        response = self.api_client.patch(
            f"/api/v1/clients/{self.target.id}/",
            {
                "is_counterparty": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.is_counterparty)
        self.assertTrue(response.data["is_counterparty"])


class ClientSimilarityServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="similar-owner")
        self.service = ClientSimilarityService()
        self.target = Client.objects.create(
            name="Иванов Иван Иванович",
            phone="+7 (999) 111-22-33",
            email="target@example.com",
            birth_date=timezone.now().date(),
            created_by=self.owner,
        )

    def test_match_by_phone(self):
        candidate = Client.objects.create(
            name="Петров Петр Петрович",
            phone="79991112233",
            email="other@example.com",
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=self.target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        candidate_entry = next(
            item for item in result["candidates"] if item["client"].id == candidate.id
        )
        self.assertIn("same_phone", candidate_entry["reasons"])
        self.assertGreaterEqual(candidate_entry["score"], 70)

    def test_match_by_email(self):
        candidate = Client.objects.create(
            name="Смирнова Анна Сергеевна",
            phone="+79990000000",
            email="TARGET@example.com",
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=self.target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        candidate_entry = next(
            item for item in result["candidates"] if item["client"].id == candidate.id
        )
        self.assertIn("same_email", candidate_entry["reasons"])
        self.assertGreaterEqual(candidate_entry["score"], 70)

    def test_match_name_patronymic_birthdate_with_changed_surname(self):
        candidate = Client.objects.create(
            name="Сидорова Иван Иванович",
            phone="+71234567890",
            email="changed@example.com",
            birth_date=self.target.birth_date,
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=self.target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        candidate_entry = next(
            item for item in result["candidates"] if item["client"].id == candidate.id
        )
        self.assertIn(
            "name_patronymic_birthdate_match",
            candidate_entry["reasons"],
        )
        self.assertGreaterEqual(candidate_entry["score"], 55)

    def test_match_short_name_to_full_name(self):
        candidate = Client.objects.create(
            name="ИВАНОВ ИВАН ИВАНОВИЧ",
            phone="",
            email="",
            birth_date=None,
            created_by=self.owner,
        )
        short_target = Client.objects.create(
            name="Иванов Иван",
            phone="",
            email="",
            birth_date=None,
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=short_target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        candidate_entry = next(
            item for item in result["candidates"] if item["client"].id == candidate.id
        )
        self.assertIn("same_surname_name", candidate_entry["reasons"])
        self.assertIn("short_full_name_match", candidate_entry["reasons"])

    def test_name_matching_ignores_case_and_yo(self):
        candidate = Client.objects.create(
            name="Сиделева Алевтина Юрьевна",
            phone="",
            email="",
            created_by=self.owner,
        )
        target = Client.objects.create(
            name="СИДЕЛЁВА АЛЕВТИНА ЮРЬЕВНА",
            phone="",
            email="",
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        candidate_entry = next(
            item for item in result["candidates"] if item["client"].id == candidate.id
        )
        self.assertIn("same_full_name", candidate_entry["reasons"])

    def test_no_false_positive_for_name_only(self):
        Client.objects.create(
            name="Иван",
            phone="",
            email="",
            birth_date=None,
            created_by=self.owner,
        )
        result = self.service.find_similar(
            target_client=self.target,
            queryset=Client.objects.alive(),
            limit=50,
        )
        self.assertEqual(result["candidates"], [])

    def test_normalize_client_name_title_cases_russian_words(self):
        self.assertEqual(
            normalize_client_name("  САЖКО   ВАСИЛИЙ АЛЕКСАНДРОВИЧ "),
            "Сажко Василий Александрович",
        )

    def test_duplicate_hints_batch_matches_phone_email_and_name(self):
        phone_target = Client.objects.create(
            name="Телефон Таргет",
            phone="+7 (926) 111-22-33",
            email="phone-target@example.com",
            created_by=self.owner,
        )
        phone_candidate = Client.objects.create(
            name="Телефон Кандидат",
            phone="89261112233",
            email="phone-candidate@example.com",
            created_by=self.owner,
        )
        email_target = Client.objects.create(
            name="Email Target",
            phone="+79990000001",
            email="MixedCase@example.com",
            created_by=self.owner,
        )
        Client.objects.create(
            name="Email Candidate",
            phone="+79990000002",
            email="mixedcase@EXAMPLE.com",
            created_by=self.owner,
        )
        name_target = Client.objects.create(
            name="Сидоров Алексей",
            phone="",
            email="",
            created_by=self.owner,
        )
        Client.objects.create(
            name="Сидоров Алексей Петрович",
            phone="",
            email="",
            created_by=self.owner,
        )

        hints = self.service.build_duplicate_hints(
            clients=[phone_target, email_target, name_target],
            queryset=Client.objects.alive(),
        )

        phone_hint = hints[str(phone_target.id)]
        self.assertGreaterEqual(phone_hint["candidate_count"], 1)
        self.assertIn("same_phone", phone_hint["reasons"])
        self.assertNotEqual(str(phone_candidate.id), phone_hint["client_id"])

        email_hint = hints[str(email_target.id)]
        self.assertGreaterEqual(email_hint["candidate_count"], 1)
        self.assertIn("same_email", email_hint["reasons"])

        name_hint = hints[str(name_target.id)]
        self.assertGreaterEqual(name_hint["candidate_count"], 1)
        self.assertIn("same_surname_name", name_hint["reasons"])

    def test_duplicate_hints_does_not_call_find_similar_per_client(self):
        clients = [
            Client.objects.create(
                name=f"Пакет Клиент {index}",
                phone=f"+7999000{index:04d}",
                email=f"batch-{index}@example.com",
                created_by=self.owner,
            )
            for index in range(12)
        ]
        Client.objects.create(
            name="Пакет Дубль",
            phone=clients[0].phone,
            email="batch-duplicate@example.com",
            created_by=self.owner,
        )

        with patch.object(
            self.service,
            "find_similar",
            side_effect=AssertionError("duplicate hints must not call find_similar"),
        ):
            with self.assertNumQueries(1):
                hints = self.service.build_duplicate_hints(
                    clients=clients,
                    queryset=Client.objects.alive(),
                )

        self.assertIn("same_phone", hints[str(clients[0].id)]["reasons"])


class ClientSimilarityAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="owner-similar", password="pass")
        self.other = User.objects.create_user(username="other-similar", password="pass")
        self.target = Client.objects.create(
            name="Иванов Иван Иванович",
            phone="+79991112233",
            email="target@example.com",
            birth_date=timezone.now().date(),
            created_by=self.owner,
        )
        self.candidate = Client.objects.create(
            name="Петров Иван Иванович",
            phone="79991112233",
            email="candidate@example.com",
            birth_date=self.target.birth_date,
            created_by=self.owner,
        )

    def test_similar_endpoint_returns_score_and_reasons(self):
        self.authenticate(self.owner)
        response = self.api_client.post(
            "/api/v1/clients/similar/",
            {
                "target_client_id": str(self.target.id),
                "limit": 50,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("candidates", response.data)
        self.assertGreaterEqual(len(response.data["candidates"]), 1)
        first = response.data["candidates"][0]
        self.assertIn("score", first)
        self.assertIn("reasons", first)
        self.assertIn("same_phone", first["reasons"])
        self.assertIn("relation_counts", first)

    def test_similar_endpoint_allows_other_authenticated_users(self):
        self.authenticate(self.other)
        response = self.api_client.post(
            "/api/v1/clients/similar/",
            {
                "target_client_id": str(self.target.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("candidates", response.data)

    def test_similar_endpoint_handles_missing_target(self):
        self.authenticate(self.owner)
        response = self.api_client.post(
            "/api/v1/clients/similar/",
            {
                "target_client_id": "00000000-0000-0000-0000-000000000001",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("target_client_id", response.data)

    def test_duplicate_hints_endpoint_returns_batch_hints(self):
        self.authenticate(self.owner)
        response = self.api_client.post(
            "/api/v1/clients/duplicate-hints/",
            {
                "client_ids": [str(self.target.id), str(self.candidate.id)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        hints = response.data["results"]
        target_hint = hints[str(self.target.id)]
        self.assertGreaterEqual(target_hint["candidate_count"], 1)
        self.assertGreaterEqual(target_hint["max_score"], 70)
        self.assertIn("same_phone", target_hint["reasons"])

    def test_duplicate_hints_endpoint_returns_email_name_and_normalization_hints(self):
        self.authenticate(self.owner)
        email_target = Client.objects.create(
            name="Email Target",
            phone="+79990000001",
            email="SAME@example.com",
            created_by=self.owner,
        )
        Client.objects.create(
            name="Email Candidate",
            phone="+79990000002",
            email="same@EXAMPLE.com",
            created_by=self.owner,
        )
        name_target = Client.objects.create(
            name="Сидоров Алексей",
            phone="",
            email="",
            created_by=self.owner,
        )
        Client.objects.create(
            name="Сидоров Алексей Петрович",
            phone="",
            email="",
            created_by=self.owner,
        )
        unique_client = Client.objects.create(
            name="САЖКО ВАСИЛИЙ АЛЕКСАНДРОВИЧ",
            phone="+79990000003",
            email="unique@example.com",
            created_by=self.owner,
        )

        response = self.api_client.post(
            "/api/v1/clients/duplicate-hints/",
            {
                "client_ids": [
                    str(email_target.id),
                    str(name_target.id),
                    str(unique_client.id),
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        hints = response.data["results"]
        self.assertIn("same_email", hints[str(email_target.id)]["reasons"])
        self.assertIn("same_surname_name", hints[str(name_target.id)]["reasons"])
        unique_hint = hints[str(unique_client.id)]
        self.assertEqual(unique_hint["candidate_count"], 0)
        self.assertTrue(unique_hint["needs_name_normalization"])
        self.assertEqual(unique_hint["normalized_name"], "Сажко Василий Александрович")

    def test_normalize_name_endpoint_updates_client_and_audit_log(self):
        self.authenticate(self.owner)
        client = Client.objects.create(
            name="САЖКО ВАСИЛИЙ АЛЕКСАНДРОВИЧ",
            created_by=self.owner,
        )
        response = self.api_client.post(
            f"/api/v1/clients/{client.id}/normalize-name/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        client.refresh_from_db()
        self.assertEqual(client.name, "Сажко Василий Александрович")
        self.assertTrue(
            AuditLog.objects.filter(
                object_type="client",
                object_id=str(client.id),
                action="update",
                actor=self.owner,
            ).exists()
        )

    def test_normalize_name_endpoint_survives_audit_log_failure(self):
        self.authenticate(self.owner)
        client = Client.objects.create(
            name="САЖКО ВАСИЛИЙ АЛЕКСАНДРОВИЧ",
            created_by=self.owner,
        )

        with patch("apps.clients.signals.AuditLog.objects.create") as create_audit_log:
            create_audit_log.side_effect = ProgrammingError(
                "audit table is unavailable"
            )
            response = self.api_client.post(
                f"/api/v1/clients/{client.id}/normalize-name/",
                {},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        client.refresh_from_db()
        self.assertEqual(client.name, "Сажко Василий Александрович")


class ClientReadAccessAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="owner-read", password="pass")
        self.other = User.objects.create_user(username="other-read", password="pass")
        self.owner_client = Client.objects.create(
            name="Owner client", created_by=self.owner
        )
        self.other_client = Client.objects.create(
            name="Other client", created_by=self.other
        )

    def test_list_returns_all_clients_for_authenticated_user(self):
        self.authenticate(self.other)

        response = self.api_client.get("/api/v1/clients/", format="json")

        self.assertEqual(response.status_code, 200)
        payload = response.data.get("results", response.data)
        client_ids = {item["id"] for item in payload}
        self.assertIn(str(self.owner_client.id), client_ids)
        self.assertIn(str(self.other_client.id), client_ids)

    def test_detail_returns_foreign_client_for_authenticated_user(self):
        self.authenticate(self.other)

        response = self.api_client.get(
            f"/api/v1/clients/{self.owner_client.id}/", format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.owner_client.id))
