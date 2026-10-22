import type { PromptAttachment } from "../../types/book.ts";

export async function readPromptAttachments(
  files: readonly File[],
  existing: readonly PromptAttachment[],
): Promise<PromptAttachment[]> {
  if (existing.length + files.length > 4)
    throw new Error("Attach up to 4 text or Markdown files.");
  const additions: PromptAttachment[] = [];
  for (const file of files) {
    if (!/\.(txt|md|markdown)$/i.test(file.name))
      throw new Error("Choose a text (.txt) or Markdown (.md) file.");
    if (file.size > 80000)
      throw new Error(`${file.name} is too large. Use a file under 80 KB.`);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
    } catch {
      throw new Error(`${file.name} could not be read as UTF-8 text.`);
    }
    if (!text.trim() || text.includes("\0"))
      throw new Error(`${file.name} does not contain readable text.`);
    if (text.length > 20000)
      throw new Error(
        `${file.name} is too long. Use fewer than 20,000 characters.`,
      );
    additions.push({ id: crypto.randomUUID(), name: file.name, text });
  }
  if (
    [...existing, ...additions].reduce((n, file) => n + file.text.length, 0) >
    60000
  )
    throw new Error("The attached files exceed 60,000 characters in total.");
  return additions;
}
