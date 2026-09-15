import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentLibrary } from "../components/DocumentLibrary";

describe("DocumentLibrary", () => {
  it("accepts supported files dropped into the library", () => {
    const onUpload = vi.fn();
    render(
      <DocumentLibrary
        documents={[]}
        busy={false}
        onUpload={onUpload}
        onDelete={vi.fn()}
      />,
    );
    const zone = screen.getByRole("button", { name: /добавить документы/i });
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(["policy"], "rules.pdf", { type: "application/pdf" })],
      },
    });
    expect(onUpload).toHaveBeenCalledWith([
      expect.objectContaining({ name: "rules.pdf" }),
    ]);
  });

  it("shows document state and calls deletion", () => {
    const document = {
      id: "doc-1",
      filename: "Условия.docx",
      status: "ready" as const,
      size: 2048,
    };
    const onDelete = vi.fn();
    render(
      <DocumentLibrary
        documents={[document]}
        busy={false}
        onUpload={vi.fn()}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("Условия.docx")).toBeInTheDocument();
    expect(screen.getByText(/Готов/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /удалить условия/i }));
    expect(onDelete).toHaveBeenCalledWith(document);
  });
});
