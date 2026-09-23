from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.db.models import Q


def document_upload_path(instance: "AiDocument", filename: str) -> str:
    return f"ai_assistant/{instance.id}/{filename}"


class AiDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename = models.CharField(max_length=512)
    file = models.FileField(upload_to=document_upload_path)
    status = models.CharField(max_length=32, default="queued", db_index=True)
    error = models.TextField(blank=True)
    chunks_count = models.PositiveIntegerField(default=0)
    insurer = models.CharField(max_length=255, blank=True)
    insurance_kind = models.CharField(max_length=255, blank=True)
    product = models.CharField(max_length=255, blank=True)
    document_type = models.CharField(max_length=255, blank=True)
    effective_from = models.CharField(max_length=32, blank=True)
    effective_to = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    indexed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class AiChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        AiDocument, on_delete=models.CASCADE, related_name="chunks"
    )
    text = models.TextField()
    location = models.JSONField(default=dict)
    page = models.PositiveIntegerField(null=True, blank=True)
    chunk_index = models.PositiveIntegerField()
    search_vector = SearchVectorField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [GinIndex(fields=["search_vector"])]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "chunk_index"],
                name="ai_chunk_document_index_unique",
            )
        ]


class AiConversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, default="Новый чат")
    provider = models.CharField(max_length=32, default="polza")
    model = models.CharField(max_length=255, blank=True)
    scope = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AiMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AiConversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=16)
    position = models.PositiveIntegerField(default=0)
    content = models.TextField(blank=True)
    citations = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    provider = models.CharField(max_length=32, blank=True)
    model = models.CharField(max_length=255, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    total_tokens = models.PositiveIntegerField(null=True, blank=True)
    cost_rub = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    request_status = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ["position", "created_at"]


class AiRun(models.Model):
    ACTIVE = ("queued", "searching", "generating")
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AiConversation, on_delete=models.CASCADE, related_name="runs"
    )
    question = models.OneToOneField(
        AiMessage, on_delete=models.CASCADE, related_name="question_run"
    )
    answer = models.OneToOneField(
        AiMessage, on_delete=models.CASCADE, related_name="answer_run"
    )
    client_request_id = models.CharField(max_length=128)
    status = models.CharField(max_length=32, default="queued", db_index=True)
    found_chunks = models.PositiveIntegerField(default=0)
    model = models.CharField(max_length=255)
    scope = models.JSONField(default=list)
    error = models.TextField(blank=True)
    stop_requested = models.BooleanField(default=False)
    worker_id = models.CharField(max_length=64, blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "client_request_id"],
                name="ai_run_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=["conversation"],
                condition=Q(status__in=["queued", "searching", "generating"]),
                name="ai_run_one_active_per_chat",
            ),
        ]
