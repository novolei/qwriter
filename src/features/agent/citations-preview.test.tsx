import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { changeLanguage } from "../../shared/i18n";
import { knowledgeChunk } from "../../test/fixtures/knowledge";
import { prepareCitations } from "../knowledge/citations";
import { KnowledgePreview } from "./KnowledgeEvidence";
import { CitationOptions } from "./CitationOptions";

vi.mock("../knowledge/repository", () => ({
  memoryRepository: { source: vi.fn().mockResolvedValue(null) },
}));
afterEach(async () => {
  cleanup();
  await changeLanguage("zh-CN");
});

function Preview() {
  const [retain, setRetain] = useState(true);
  const citations = prepareCitations(
    `[Observation](#knowledge-${knowledgeChunk.id}) [Unknown](#knowledge-forged)`,
    [knowledgeChunk],
    retain,
  );
  return (
    <>
      <CitationOptions
        citations={citations}
        retain={retain}
        disabled={false}
        onChange={setRetain}
      />
      <KnowledgePreview
        markdown={citations.markdown}
        sources={[knowledgeChunk]}
        documentId="one"
        citationReferences={citations.references}
      />
    </>
  );
}
it("opens portable citations as snapshots and restores keyboard focus on close", async () => {
  render(<Preview />);
  const link = screen.getByRole("button", { name: "Observation" });
  link.focus();
  fireEvent.click(link);
  expect(await screen.findByText(/来源已归档/)).toBeTruthy();
  expect(link.isConnected).toBe(true);
  expect(screen.getByRole("dialog").textContent).toContain(
    knowledgeChunk.content,
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(document.activeElement).toBe(link));
  expect(screen.queryByRole("button", { name: "Unknown" })).toBeNull();
});
it("updates source retention and localized explanations without leaving broken links", async () => {
  await act(() => changeLanguage("en"));
  render(<Preview />);
  expect(screen.getByText(/Source snapshots: 1/)).toBeTruthy();
  expect(screen.getByText(/Unmatched citations: 1/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Keep sources with the document" }),
  );
  expect(screen.getByText(/Keep only the draft/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Observation" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Sources" })).toBeNull();
});
