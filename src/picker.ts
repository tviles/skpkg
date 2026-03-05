import { checkbox } from "@inquirer/prompts";
import type { ScannedItem } from "./types.js";

export async function pickItems(items: ScannedItem[]): Promise<ScannedItem[]> {
  const choices = items.map(item => ({
    name: `[${item.type}] ${item.name}${item.description ? ` — ${item.description}` : ""}`,
    value: item,
  }));

  const selected = await checkbox({
    message: "Select items to share:",
    choices,
  });

  return selected;
}
