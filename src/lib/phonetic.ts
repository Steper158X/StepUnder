import type { Lyrics } from "~/lib/types";

/**
 * Phonetic lyrics: a reading line (romaji, Revised Romanization, pinyin)
 * under Japanese, Korean and Chinese lyric lines. The converters are loaded
 * only once a song actually needs them; the Japanese dictionary alone is
 * ~18MB, so it is fetched from `kuromoji-dict/` (see vite.config.ts).
 */

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HANGUL = /[가-힣]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const LETTER = /\p{L}/u;
const NON_LATIN_LETTER = /(?![\p{Script=Latin}])\p{L}/u;

/** Text made of CJK or Hangul characters that a reading line can help with. */
export function needsReading(text: string): boolean {
  return KANA.test(text) || HANGUL.test(text) || HAN.test(text);
}

/** Has letters, and all of them are Latin (a romanized line or English). */
export function isLatinText(text: string): boolean {
  return LETTER.test(text) && !NON_LATIN_LETTER.test(text);
}

// ------------------------------------------------------------------ Korean

const KO_INITIALS = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
  "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];
const KO_MEDIALS = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
  "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
/** Final consonant said at the end of a syllable. */
const KO_FINALS = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l",
  "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t",
];
/**
 * Final consonant before a silent ㅇ onset: [what stays, what moves over].
 * e.g. 음악 → eu + mak, 읽어 → il + geo.
 */
const KO_LIAISON: Array<[string, string]> = [
  ["", ""], ["", "g"], ["", "kk"], ["k", "s"], ["", "n"], ["n", "j"],
  ["n", ""], ["", "d"], ["", "r"], ["l", "g"], ["l", "m"], ["l", "b"],
  ["l", "s"], ["l", "t"], ["l", "p"], ["l", ""], ["", "m"], ["", "b"],
  ["p", "s"], ["", "s"], ["", "ss"], ["ng", ""], ["", "j"], ["", "ch"],
  ["", "k"], ["", "t"], ["", "p"], ["", ""],
];
const KO_INITIAL_SILENT = 11;
const KO_INITIAL_N = 2;
const KO_INITIAL_R = 5;
const KO_FINAL_N = 4;
const KO_FINAL_L = 8;

/** Revised Romanization, with liaison across syllables of one word. */
export function romanizeKorean(text: string): string {
  const syllable = (char: string | undefined) => {
    const code = (char?.codePointAt(0) ?? 0) - 0xac00;
    return code >= 0 && code <= 11171 ? code : -1;
  };
  const chars = [...text];
  let out = "";
  // Onset the previous syllable handed over, replacing this one's own.
  let carry: string | null = null;
  for (let i = 0; i < chars.length; i += 1) {
    const code = syllable(chars[i]);
    if (code < 0) {
      out += chars[i];
      carry = null;
      continue;
    }
    const final = code % 28;
    const next = syllable(chars[i + 1]);
    const nextInitial = next < 0 ? -1 : Math.floor(next / 588);
    const onset = carry ?? KO_INITIALS[Math.floor(code / 588)];
    const vowel = KO_MEDIALS[Math.floor((code % 588) / 28)];
    carry = null;

    if (final && nextInitial === KO_INITIAL_SILENT) {
      const [stay, move] = KO_LIAISON[final];
      out += onset + vowel + stay;
      carry = move;
    } else {
      // ㄹㄹ, ㄴㄹ and ㄹㄴ are all said "ll" (설날 → seollal).
      const ll =
        (final === KO_FINAL_L || final === KO_FINAL_N) &&
        (nextInitial === KO_INITIAL_R || nextInitial === KO_INITIAL_N) &&
        (final === KO_FINAL_L || nextInitial === KO_INITIAL_R);
      out += onset + vowel + (ll ? "l" : KO_FINALS[final]);
      if (ll) carry = "l";
    }
  }
  return out;
}

// ----------------------------------------------------------------- Chinese

async function romanizeChinese(lines: string[]): Promise<string[]> {
  const { pinyin } = await import("pinyin-pro");
  return lines.map((line) =>
    pinyin(line, { nonZh: "consecutive", toneType: "symbol" })
      .replace(/[，。！？：；、]/g, (mark) => FULL_WIDTH_PUNCTUATION[mark])
      .replace(/\s+([,.!?:;])/g, "$1"),
  );
}

const FULL_WIDTH_PUNCTUATION: Record<string, string> = {
  "，": ",",
  "。": ".",
  "！": "!",
  "？": "?",
  "：": ":",
  "；": ";",
  "、": ",",
};

// ---------------------------------------------------------------- Japanese

type Tokenizer = Awaited<
  ReturnType<import("@patdx/kuromoji").TokenizerBuilder["build"]>
>;

let tokenizerPromise: Promise<Tokenizer> | undefined;

/** Reads a dictionary file, unpacking it unless the server already did. */
async function loadDictFile(name: string): Promise<ArrayBufferLike> {
  const response = await fetch(`${import.meta.env.BASE_URL}kuromoji-dict/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${name}: ${response.status}`);
  }
  const data = await response.arrayBuffer();
  const bytes = new Uint8Array(data, 0, 2);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return data;
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

function loadTokenizer(): Promise<Tokenizer> {
  tokenizerPromise ??= import("@patdx/kuromoji")
    .then(({ TokenizerBuilder }) =>
      new TokenizerBuilder({
        loader: { loadArrayBuffer: loadDictFile },
      }).build(),
    )
    .catch((error) => {
      tokenizerPromise = undefined;
      throw error;
    });
  return tokenizerPromise;
}

/** Particles that are written one way and said another. */
const PARTICLE_READINGS: Record<string, string> = {
  は: "ワ",
  へ: "エ",
  を: "オ",
};

async function romanizeJapanese(lines: string[]): Promise<string[]> {
  const [tokenizer, { toRomaji }] = await Promise.all([
    loadTokenizer(),
    import("wanakana"),
  ]);
  return lines.map((line) => {
    // Words are kept in kana until the end so a trailing っ still doubles
    // the consonant of an ending that follows (知っ + た → shitta).
    const words: string[] = [];
    for (const token of tokenizer.tokenize(line)) {
      const surface = token.surface_form;
      if (!surface.trim()) continue;
      let kana = surface;
      if (token.pos === "助詞" && PARTICLE_READINGS[surface]) {
        kana = PARTICLE_READINGS[surface];
      } else if (token.reading && token.reading !== "*" && HAN.test(surface)) {
        kana = token.reading;
      }
      // Endings and helpers read as part of the word before them.
      const attach =
        words.length > 0 &&
        (token.pos === "助動詞" ||
          token.pos_detail_1 === "接尾" ||
          token.pos_detail_1 === "非自立" ||
          (token.pos_detail_1 === "接続助詞" && /^[てで]$/.test(surface)) ||
          token.pos === "記号");
      if (attach) words[words.length - 1] += kana;
      else words.push(kana);
    }
    return words.map((word) => toRomaji(word)).join(" ");
  });
}

// -------------------------------------------------------------------- main

/**
 * Fills `phonetic` on lines that need one and do not have it yet (lines may
 * already carry a reading from the lyrics file). Han-only lines are read as
 * Japanese when the song has kana anywhere, otherwise as Chinese.
 */
export async function addPhonetics(lyrics: Lyrics): Promise<Lyrics> {
  const japanese = lyrics.lines.some((line) => KANA.test(line.value));
  const phonetics = lyrics.lines.map((line) => line.phonetic);

  const jaIndexes: number[] = [];
  const zhIndexes: number[] = [];
  lyrics.lines.forEach((line, index) => {
    if (line.phonetic || !needsReading(line.value)) return;
    if (HANGUL.test(line.value)) {
      phonetics[index] = romanizeKorean(line.value);
    } else if (japanese || KANA.test(line.value)) {
      jaIndexes.push(index);
    } else {
      zhIndexes.push(index);
    }
  });

  const fill = async (
    indexes: number[],
    convert: (lines: string[]) => Promise<string[]>,
  ) => {
    if (!indexes.length) return;
    try {
      const results = await convert(
        indexes.map((index) => lyrics.lines[index].value),
      );
      indexes.forEach((index, i) => {
        phonetics[index] = results[i];
      });
    } catch (error) {
      console.error("Failed to build phonetic lyrics", error);
    }
  };
  await Promise.all([
    fill(jaIndexes, romanizeJapanese),
    fill(zhIndexes, romanizeChinese),
  ]);

  return {
    ...lyrics,
    lines: lyrics.lines.map((line, index) => {
      const phonetic = phonetics[index]?.replace(/\s+/g, " ").trim();
      return phonetic && phonetic !== line.value ? { ...line, phonetic } : line;
    }),
  };
}
