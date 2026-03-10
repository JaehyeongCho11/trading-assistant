// Reads all .txt and .md files from the knowledge/ directory at runtime
// and returns their combined content for the system prompt.

export async function loadKnowledge(): Promise<string> {
  const knowledgeDir = new URL("./knowledge", import.meta.url).pathname;
  const chunks: string[] = [];

  try {
    for await (const entry of Deno.readDir(knowledgeDir)) {
      if (!entry.isFile) continue;
      const name = entry.name.toLowerCase();
      if (!name.endsWith(".txt") && !name.endsWith(".md")) continue;
      if (name === "readme.md") continue;

      try {
        const content = await Deno.readTextFile(`${knowledgeDir}/${entry.name}`);
        chunks.push(`### [${entry.name}]\n${content}`);
      } catch (e) {
        console.error(`Failed to read knowledge file ${entry.name}:`, e);
      }
    }
  } catch (e) {
    console.error("Failed to read knowledge directory:", e);
  }

  if (chunks.length === 0) return "";
  return "\n\n## EMBEDDED DOCUMENTS\n\n" + chunks.join("\n\n---\n\n");
}
