import { describe, it, expect, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readJson, validateQuizFile } from "../../build.js";
import * as fs from "node:fs/promises";

describe("readJson", () => {
  it("should read and parse a valid JSON file", async () => {
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ key: "value" }));

    const data = await readJson("C:.../data/test.json");

    expect(data).toEqual({ key: "value" });
  });

  it("should return null on file read error", async () => {
    fs.readFile.mockRejectedValueOnce(new Error("File not found"));

    const data = await readJson("./data/nonexistent.json");

    expect(data).toBeNull();
  });

  it("should return null on JSON parse error", async () => {
    fs.readFile.mockResolvedValueOnce("invalid json");

    const data = await readJson("./data/bad.json");

    expect(data).toBeNull();
  });
});

describe("validateQuizFile", () => {
  it("should return valid if JSON is properly formatted", async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        title: "Sample Quiz",
        questions: [
          { question: "Q1?", answers: [{ answer: "A1", correct: true }] },
        ],
      })
    );

    const result = await validateQuizFile("valid.json");
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("should return invalid if JSON has missing title", async () => {
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ questions: [] }));

    const result = await validateQuizFile("invalid.json");
    expect(result.valid).toBe(false);
  });

  it("should return invalid if JSON questions are not an array", async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({ title: "Quiz", questions: null })
    );

    const result = await validateQuizFile("invalid.json");
    expect(result.valid).toBe(false);
  });
});
