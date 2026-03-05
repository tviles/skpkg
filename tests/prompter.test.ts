import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
}));

import { promptOverwrite } from "../src/prompter.js";
import { select } from "@inquirer/prompts";

const mockSelect = vi.mocked(select);

describe("promptOverwrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accepted names for new items without prompting", async () => {
    const existingNames = new Set(["skill1"]);
    const newNames = ["skill2", "skill3"];

    const result = await promptOverwrite(newNames, existingNames);

    expect(mockSelect).not.toHaveBeenCalled();
    expect(result).toEqual(["skill2", "skill3"]);
  });

  it("prompts for existing items and includes accepted", async () => {
    const existingNames = new Set(["skill1", "skill2"]);
    const newNames = ["skill1", "skill2", "skill3"];
    mockSelect.mockResolvedValueOnce("yes").mockResolvedValueOnce("no");

    const result = await promptOverwrite(newNames, existingNames);

    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(result).toEqual(["skill1", "skill3"]); // skill1 (accepted) + skill3 (new)
  });

  it("yes-to-all skips remaining prompts", async () => {
    const existingNames = new Set(["skill1", "skill2", "skill3"]);
    const newNames = ["skill1", "skill2", "skill3"];
    mockSelect.mockResolvedValueOnce("all");

    const result = await promptOverwrite(newNames, existingNames);

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["skill1", "skill2", "skill3"]);
  });

  it("returns empty array when all existing items are skipped and no new items", async () => {
    const existingNames = new Set(["skill1"]);
    const newNames = ["skill1"];
    mockSelect.mockResolvedValueOnce("no");

    const result = await promptOverwrite(newNames, existingNames);

    expect(result).toEqual([]);
  });
});
