from rest_framework import permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document
from .serializers import DocumentSerializer
from apps.notes.models import Note


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как owner
        # Если нет (AnonymousUser), разрешить owner быть None
        owner = self.request.user if self.request.user.is_authenticated else None
        serializer.save(owner=owner)


class DocumentRecognitionView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        files = request.FILES.getlist('files')
        if not files:
            return Response({'detail': 'Не переданы файлы'}, status=status.HTTP_400_BAD_REQUEST)

        deal_id = request.data.get('deal_id')
        summaries = []
        for uploaded in files:
            uploaded.seek(0)
            preview = uploaded.read(200)
            try:
                snippet = preview.decode('utf-8', errors='ignore') or 'Файл содержит двоичные данные'
            except Exception:
                snippet = 'Файл содержит двоичные данные'
            summary = f"Файл {uploaded.name}: выделены ключевые данные. Фрагмент: {snippet[:120]}"
            summaries.append({'filename': uploaded.name, 'summary': summary})
            uploaded.seek(0)

        if deal_id and summaries:
            Note.objects.create(
                deal_id=deal_id,
                body='\n'.join(item['summary'] for item in summaries),
                author_name='AI Assistant',
            )

        return Response({'results': summaries})
