import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chat } from "../components/Chat";

describe("Chat", () => {
  afterEach(cleanup);

  it("sends the entered question and opens a source", () => {
    const onSend = vi.fn();
    const onCitation = vi.fn();
    render(
      <Chat
        disabled={false}
        sending={false}
        onSend={onSend}
        onCitation={onCitation}
        messages={[
          {
            id: "a",
            role: "assistant",
            content: "Франшиза применяется.",
            citations: [
              {
                document_id: "d",
                filename: "Правила.pdf",
                location: { page: 4 },
                excerpt: "Текст правила",
              },
            ],
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Вопрос"), {
      target: { value: "Что с франшизой?" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Отправить вопрос" }).closest("form")!,
    );
    expect(onSend).toHaveBeenCalledWith("Что с франшизой?");
    fireEvent.click(
      screen.getByRole("button", { name: /правила.pdf, стр. 4/i }),
    );
    expect(onCitation).toHaveBeenCalledWith(
      expect.objectContaining({ document_id: "d" }),
    );
  });

  it("switches provider and exposes model metadata", () => {
    const onProviderChange = vi.fn();
    const onModelChange = vi.fn();
    render(
      <Chat
        disabled={false}
        sending={false}
        onSend={vi.fn()}
        onCitation={vi.fn()}
        provider="codex"
        model="gpt-5.6-terra"
        providers={[
          {
            id: "codex",
            label: "Codex",
            available: true,
            models: ["gpt-5.6-terra", "openai/gpt-4o"],
          },
          {
            id: "polza",
            label: "Polza",
            available: true,
            models: ["openai/gpt-4o-mini", "openai/gpt-4o"],
          },
        ]}
        usage={{ providers: [], requests: 0, cost_rub: 0 }}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
        messages={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Провайдер"), {
      target: { value: "polza" },
    });
    fireEvent.change(screen.getByLabelText("Модель"), {
      target: { value: "openai/gpt-4o" },
    });
    expect(onProviderChange).toHaveBeenCalledWith("polza");
    expect(onModelChange).toHaveBeenCalledWith("openai/gpt-4o");
    expect(screen.getByText(/всего Polza/i)).toBeInTheDocument();
  });
});
