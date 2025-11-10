from django.contrib import admin

from .models import Deal, DealStage, Pipeline


@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_default')
    list_filter = ('is_default',)
    search_fields = ('name', 'code')


@admin.register(DealStage)
class DealStageAdmin(admin.ModelAdmin):
    list_display = ('name', 'pipeline', 'order_index')
    list_filter = ('pipeline',)
    ordering = ('pipeline', 'order_index')


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'stage', 'amount', 'status', 'owner')
    list_filter = ('status', 'pipeline')
    search_fields = ('title',)
