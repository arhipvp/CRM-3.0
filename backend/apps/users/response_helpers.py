from rest_framework.response import Response


def error_response(message: str, status_code: int) -> Response:
    return Response({"error": message}, status=status_code)


def message_response(message: str, status_code: int) -> Response:
    return Response({"message": message}, status=status_code)
