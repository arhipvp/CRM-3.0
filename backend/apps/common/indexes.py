from django.contrib.postgres.indexes import GinIndex, OpClass
from django.db import models
from django.db.models.functions import Upper


class PostgresTrigramIndex(GinIndex):
    """GIN trigram index on PostgreSQL with a SQLite-safe test fallback."""

    def __init__(self, field_name: str, *, name: str):
        self.field_name = field_name
        super().__init__(
            OpClass(Upper(field_name), name="gin_trgm_ops"),
            name=name,
        )

    def create_sql(self, model, schema_editor, using="", **kwargs):
        if schema_editor.connection.vendor != "postgresql":
            fallback = models.Index(fields=[self.field_name], name=self.name)
            return fallback.create_sql(model, schema_editor, using=using, **kwargs)
        return super().create_sql(model, schema_editor, using=using, **kwargs)

    def deconstruct(self):
        path = f"{self.__class__.__module__}.{self.__class__.__name__}"
        return path, (self.field_name,), {"name": self.name}
