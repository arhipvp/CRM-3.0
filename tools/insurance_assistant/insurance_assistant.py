"""Entry point: python -m insurance_assistant."""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.getenv("INSURANCE_ASSISTANT_HOST", "127.0.0.1"),
        port=int(os.getenv("INSURANCE_ASSISTANT_PORT", "8765")),
        reload=False,
    )
