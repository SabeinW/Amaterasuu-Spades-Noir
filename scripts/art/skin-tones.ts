// Paint the skin-tone copies of the court cards and Jokers with Qalam
// (GPT Image 2.6 edits, medium, about $0.044 each). Only the skin changes:
// faces, hair, clothes, pose and background stay as painted.
//
//   cd ~/Documents/Qalam && npx tsx <repo>/scripts/art/skin-tones.ts <out-dir> <tones|all> [set,set,...] [concurrency]
//   python3 scripts/art/install-skin-tones.py <out-dir>
//
// e.g. a new court set "harbor": skin-tones.ts ~/spades-art/tones all harbor
// Resumable: outputs already in <out-dir> are skipped. 14 cards x 4 tones = 56 edits per set.
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, waitFor } from "/home/raheemlinuxmaster/Documents/Qalam/src/mcp/service";
import { toAssetIds } from "/home/raheemlinuxmaster/Documents/Qalam/src/mcp/assets";

const COURT = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/art/court");
const CARDS = [..."JQK"].flatMap((v) => [..."SHDC"].map((s) => v + s)).concat(["JOKER_BIG", "JOKER_SMALL"]);
// Keep in step with SKIN_TONES in src/lib/skinTone.js (brown is the original).
const TONES: Record<string, string> = {
  pale: "very fair, pale skin with soft pink undertones",
  olive: "light olive-tan skin, a warm beige with golden-olive undertones",
  light: "light skin, a warm light caramel, light golden-brown tone",
  deep: "deep, rich dark-brown skin, clearly darker than now, with cool ebony undertones",
};
const prompt = (tone: string) =>
  `Edit this playing-card illustration. Change only the skin colour of every person in it to ${TONES[tone]}. ` +
  "Keep everything else exactly the same: the same faces, features, expressions, hair texture, hairstyles and hair colour, beards, crowns, jewellery, clothing, masks, poses, hands, animals, spirits and creatures, background, colours, lighting and art style. " +
  "Same composition and crop. Shade the new skin tone naturally with the same light.";

async function main() {
  const [outDir, toneArg, setArg, concArg] = process.argv.slice(2);
  if (!outDir || !toneArg) throw new Error("usage: skin-tones.ts <out-dir> <tones|all> [sets] [concurrency]");
  const tones = toneArg === "all" ? Object.keys(TONES) : toneArg.split(",");
  const sets = setArg ? setArg.split(",") : readdirSync(COURT).filter((d) => statSync(join(COURT, d)).isDirectory());
  const conc = Number(concArg ?? 10);
  const todo: { tone: string; name: string; src: string }[] = [];
  for (const tone of tones) {
    if (!TONES[tone]) throw new Error(`unknown tone ${tone}`);
    mkdirSync(join(outDir, tone), { recursive: true });
    for (const set of sets)
      for (const card of CARDS) {
        const name = `${set}__${card}`;
        if (!existsSync(join(outDir, tone, `${name}.png`))) todo.push({ tone, name, src: join(COURT, set, `${card}.webp`) });
      }
  }
  console.error(`todo ${todo.length}`);
  const refs = new Map<string, string>();
  let ok = 0, failed = 0, usd = 0, i = 0;
  async function one(t: (typeof todo)[number]) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (!refs.has(t.src)) refs.set(t.src, (await toAssetIds([t.src]))[0]);
        const job = await generate({ model: "gpt-image-2.6", prompt: prompt(t.tone), references: [refs.get(t.src)!], settings: { aspectRatio: "3:4", quality: "medium" }, maxCredits: 12 });
        const [r] = (await waitFor([job.jobId], { saveDir: join(outDir, t.tone), names: [t.name], timeoutS: 900 })) as any[];
        if (r.status === "succeeded") return void (ok++, (usd += r.providerUsd ?? 0));
        console.error(`job ${t.tone}/${t.name} ${r.status}`);
      } catch (e) {
        console.error(`error ${t.tone}/${t.name} attempt ${attempt}: ${String(e).slice(0, 200)}`);
        if (String(e).includes("daily cap")) process.exit(2);
      }
    }
    failed++;
  }
  await Promise.all(
    Array.from({ length: conc }, async () => {
      while (i < todo.length) {
        await one(todo[i++]);
        console.error(`progress ${ok + failed}/${todo.length} ok=${ok} failed=${failed} $${usd.toFixed(2)}`);
      }
    }),
  );
  console.log(`finished ok=${ok} failed=${failed} $${usd.toFixed(2)}`);
  process.exit(0);
}
main().catch((e) => (console.error(e), process.exit(1)));
