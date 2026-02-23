import time

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.deals.services import DealSimilarityService
from apps.finances.models import Payment
from apps.policies.models import Policy
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status


class DealSimilarityServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="similar-service")
        self.client_obj = Client.objects.create(name="Similarity Client")
        self.target = Deal.objects.create(
            title="Ипотека | 0009240-9071109/24И",
            description="Сделка по ипотеке, ref SYS2586025512",
            client=self.client_obj,
            seller=self.user,
            executor=self.user,
            source="sber",
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.base_candidate = Deal.objects.create(
            title="Ипотека",
            description="Простая сделка",
            client=self.client_obj,
            seller=self.user,
            executor=self.user,
            source="sber",
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.strong_candidate = Deal.objects.create(
            title="Ипотека | 0009240-9071109/24И",
            description="Дублирующая сделка, ref SYS2586025512",
            client=self.client_obj,
            seller=self.user,
            executor=self.user,
            source="sber",
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )

        insurer = InsuranceCompany.objects.create(name="Acme Similarity")
        ins_type = InsuranceType.objects.create(name="Mortgage Similarity")
        Policy.objects.create(
            number="P-SAME-001",
            insurance_company=insurer,
            insurance_type=ins_type,
            deal=self.target,
        )
        Policy.objects.create(
            number="P-SAME-001",
            insurance_company=insurer,
            insurance_type=ins_type,
            deal=self.strong_candidate,
        )
        Payment.objects.create(
            deal=self.target,
            amount=100,
            description="Оплата по заявке SYS2586025512",
        )
        Payment.objects.create(
            deal=self.strong_candidate,
            amount=200,
            description="Повторная оплата SYS2586025512",
        )

    def test_score_increases_with_policy_and_reference_overlap(self):
        queryset = Deal.objects.filter(client=self.client_obj)
        result = DealSimilarityService().find_similar(
            target_deal=self.target,
            queryset=queryset,
            include_self=False,
            include_closed=True,
            limit=10,
        )
        by_id = {str(item["deal"].id): item for item in result["candidates"]}

        self.assertIn(str(self.base_candidate.id), by_id)
        self.assertIn(str(self.strong_candidate.id), by_id)
        self.assertGreater(
            by_id[str(self.strong_candidate.id)]["score"],
            by_id[str(self.base_candidate.id)]["score"],
        )


class DealSimilarityAPITestCase(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create_user(username="seller-similar")
        self.other = User.objects.create_user(username="other-similar")
        self.client_obj = Client.objects.create(name="API Similar Client")
        self.target = Deal.objects.create(
            title="Ипотека",
            description="Главная сделка REF123456",
            client=self.client_obj,
            seller=self.seller,
            executor=self.seller,
            source="bank",
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.candidate_open = Deal.objects.create(
            title="Ипотека",
            description="Похожая сделка REF123456",
            client=self.client_obj,
            seller=self.seller,
            executor=self.seller,
            source="bank",
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.candidate_closed = Deal.objects.create(
            title="Ипотека",
            client=self.client_obj,
            seller=self.seller,
            status=Deal.DealStatus.WON,
            stage_name="initial",
        )
        self.candidate_deleted = Deal.objects.create(
            title="Ипотека",
            client=self.client_obj,
            seller=self.seller,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        self.candidate_deleted.delete()
        self.other_client = Client.objects.create(name="Other")
        self.foreign_deal = Deal.objects.create(
            title="Ипотека",
            client=self.other_client,
            seller=self.seller,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )

        self.newer_candidate = Deal.objects.create(
            title="Ипотека",
            client=self.client_obj,
            seller=self.seller,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        time.sleep(0.01)
        self.newer_candidate.description = "refresh ordering"
        self.newer_candidate.save(update_fields=["description"])

        self.token_for(self.seller)
        self.token_for(self.other)

    def _post(self, user, payload):
        self.authenticate(user)
        return self.api_client.post("/api/v1/deals/similar/", payload, format="json")

    def test_returns_candidates_for_same_client(self):
        response = self._post(self.seller, {"target_deal_id": str(self.target.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidate_ids = [item["deal"]["id"] for item in response.data["candidates"]]
        self.assertIn(str(self.candidate_open.id), candidate_ids)
        self.assertNotIn(str(self.foreign_deal.id), candidate_ids)

    def test_excludes_target_when_include_self_false(self):
        response = self._post(
            self.seller,
            {"target_deal_id": str(self.target.id), "include_self": False},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidate_ids = [item["deal"]["id"] for item in response.data["candidates"]]
        self.assertNotIn(str(self.target.id), candidate_ids)

    def test_include_closed_and_deleted_flags(self):
        response_default = self._post(
            self.seller, {"target_deal_id": str(self.target.id)}
        )
        ids_default = {
            item["deal"]["id"] for item in response_default.data["candidates"]
        }
        self.assertNotIn(str(self.candidate_closed.id), ids_default)
        self.assertNotIn(str(self.candidate_deleted.id), ids_default)

        response_with_flags = self._post(
            self.seller,
            {
                "target_deal_id": str(self.target.id),
                "include_closed": True,
                "include_deleted": True,
            },
        )
        ids_with_flags = {
            item["deal"]["id"] for item in response_with_flags.data["candidates"]
        }
        self.assertIn(str(self.candidate_closed.id), ids_with_flags)
        self.assertIn(str(self.candidate_deleted.id), ids_with_flags)

    def test_ordering_by_score_then_updated_at_desc(self):
        response = self._post(
            self.seller,
            {
                "target_deal_id": str(self.target.id),
                "limit": 10,
                "include_closed": False,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        candidates = response.data["candidates"]
        self.assertGreaterEqual(len(candidates), 2)
        for index in range(len(candidates) - 1):
            left = candidates[index]
            right = candidates[index + 1]
            self.assertGreaterEqual(left["score"], right["score"])

    def test_no_access_returns_validation_error(self):
        response = self._post(self.other, {"target_deal_id": str(self.target.id)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target_deal_id", response.data)

    def test_empty_candidates_returns_valid_meta(self):
        unique_client = Client.objects.create(name="Unique")
        unique_target = Deal.objects.create(
            title="Unique deal",
            client=unique_client,
            seller=self.seller,
            status=Deal.DealStatus.OPEN,
            stage_name="initial",
        )
        response = self._post(self.seller, {"target_deal_id": str(unique_target.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["candidates"], [])
        self.assertIn("meta", response.data)
        self.assertEqual(response.data["meta"]["returned"], 0)
