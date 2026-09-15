import asyncio

from app.providers import PolzaTransport, _usage


def test_polza_usage_reads_cost_and_token_aliases():
    usage = _usage(
        {
            "usage": {
                "prompt_tokens": 12,
                "completion_tokens": 8,
                "total_tokens": 20,
                "cost_rub": "0.37",
            }
        },
        "polza-model",
    )
    assert usage.provider == "polza"
    assert usage.total_tokens == 20
    assert usage.cost_rub == 0.37


def test_polza_stream_emits_text_and_usage(monkeypatch):
    class FakeResponse:
        status_code = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def aiter_lines(self):
            yield 'data: {"choices":[{"delta":{"content":"Привет"}}]}'
            yield 'data: {"usage":{"prompt_tokens":3,"completion_tokens":2,"cost_rub":0.11}}'
            yield "data: [DONE]"

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def stream(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(
        "app.providers.httpx.AsyncClient", lambda *args, **kwargs: FakeClient()
    )

    async def collect():
        return [
            event
            async for event in PolzaTransport("https://polza.test/v1", "secret").answer(
                "q", "m"
            )
        ]

    events = asyncio.run(collect())
    assert "".join(event.delta for event in events) == "Привет"
    assert events[-1].usage is not None
    assert events[-1].usage.cost_rub == 0.11
