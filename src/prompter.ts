import { select } from "@inquirer/prompts";

export async function promptOverwrite(
  newNames: string[],
  existingNames: Set<string>,
): Promise<string[]> {
  const accepted: string[] = [];
  let yesToAll = false;

  for (const name of newNames) {
    if (!existingNames.has(name)) {
      accepted.push(name);
      continue;
    }

    if (yesToAll) {
      accepted.push(name);
      continue;
    }

    const action = await select({
      message: `"${name}" already exists in gist. Overwrite?`,
      choices: [
        { name: "Yes", value: "yes" },
        { name: "No", value: "no" },
        { name: "Yes to all", value: "all" },
      ],
    });

    if (action === "yes") {
      accepted.push(name);
    } else if (action === "all") {
      yesToAll = true;
      accepted.push(name);
    }
  }

  return accepted;
}
