export type PassageVocabItem = {
  term: string;
  definition: string;
  simple_meaning_en?: string;
  example_sentence_en?: string;
  meaning_vi?: string;
  sentence_index?: number;
};

const MAX_VOCAB_ITEMS = 6;

const STOP_WORDS = new Set([
  "a",
  "about",
  "across",
  "after",
  "all",
  "also",
  "an",
  "and",
  "another",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "during",
  "each",
  "either",
  "every",
  "for",
  "from",
  "had",
  "has",
  "have",
  "having",
  "how",
  "however",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "less",
  "lies",
  "like",
  "mainly",
  "make",
  "many",
  "may",
  "might",
  "more",
  "most",
  "much",
  "must",
  "not",
  "now",
  "of",
  "often",
  "on",
  "once",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "rather",
  "same",
  "should",
  "simply",
  "since",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "therefore",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "under",
  "up",
  "used",
  "using",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "without",
]);

const ALLOWED_CONNECTOR_WORDS = new Set([
  "of",
  "and",
  "for",
  "to",
  "in",
  "on",
  "with",
  "by",
  "from",
]);

const VI_TRANSLATIONS: Record<string, string> = {
  adaptation: "sự thích nghi",
  agriculture: "nông nghiệp",
  algae: "tảo",
  atmosphere: "khí quyển",
  attribution: "quy kết",
  audit: "kiểm toán",
  biodiversity: "đa dạng sinh học",
  bleaching: "tẩy trắng",
  climate: "khí hậu",
  compass: "la bàn",
  congestion: "tắc nghẽn",
  conservation: "bảo tồn",
  continuity: "tính liên tục",
  coral: "san hô",
  credentials: "chứng chỉ",
  decipherment: "giải mã",
  dependability: "độ tin cậy",
  ecology: "sinh thái học",
  ecological: "sinh thái",
  ecosystem: "hệ sinh thái",
  efficiency: "hiệu quả",
  evidence: "bằng chứng",
  extinction: "sự tuyệt chủng",
  framework: "khung",
  fungi: "nấm",
  geology: "địa chất học",
  governance: "quản trị",
  heritage: "di sản",
  infrastructure: "hạ tầng",
  institutional: "thể chế",
  intelligence: "trí thông minh",
  interpretation: "diễn giải",
  literacy: "trình độ biết chữ",
  lunar: "mặt trăng",
  mechanism: "cơ chế",
  modular: "mô-đun",
  navigation: "điều hướng",
  nitrogen: "nitơ",
  oxygen: "oxy",
  pattern: "mẫu",
  policy: "chính sách",
  pollution: "ô nhiễm",
  predictive: "dự đoán",
  pricing: "định giá",
  resilience: "khả năng phục hồi",
  risk: "rủi ro",
  route: "tuyến đường",
  sentence: "câu",
  significance: "ý nghĩa",
  species: "loài",
  structure: "cấu trúc",
  sustainability: "tính bền vững",
  symbolic: "biểu tượng",
  tectonics: "kiến tạo",
  theory: "lý thuyết",
  transmission: "lây truyền",
  transition: "chuyển đổi",
  variability: "tính biến thiên",
  vulnerability: "tính dễ tổn thương",
  watershed: "lưu vực",
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeWord(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function normalizeTermKey(term: string): string {
  return normalizeSpaces(
    term.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " "),
  );
}

function tokenize(text: string): string[] {
  const matches = text.match(/[A-Za-z][A-Za-z'-]*/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((token) => normalizeWord(token))
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

export function splitPassageIntoSentences(passage: string): string[] {
  return passage
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeSpaces(sentence))
    .filter((sentence) => sentence.length > 0);
}

function sentenceIndexOfTerm(sentences: string[], term: string): number | undefined {
  const termKey = normalizeTermKey(term);
  if (termKey.length === 0) {
    return undefined;
  }

  for (let index = 0; index < sentences.length; index += 1) {
    const sentenceKey = normalizeTermKey(sentences[index]);
    if (sentenceKey.includes(termKey)) {
      return index + 1;
    }
  }

  return undefined;
}

function resolveVietnameseMeaning(term: string): string | undefined {
  const key = normalizeTermKey(term);
  if (!key) {
    return undefined;
  }

  if (VI_TRANSLATIONS[key]) {
    return VI_TRANSLATIONS[key];
  }

  const parts = key.split(/[\s-]+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }

  return parts.map((part) => VI_TRANSLATIONS[part] ?? part).join(" ");
}

function buildDefinition(
  term: string,
  sentence: string | undefined,
  topicLabel: string,
): string {
  if (sentence && sentence.length > 0) {
    if (sentence.length <= 190) {
      return sentence;
    }
    return `${sentence.slice(0, 187).trimEnd()}...`;
  }

  return `${term} is a key concept in this passage about ${topicLabel}.`;
}

type Candidate = {
  score: number;
  term: string;
  sentenceIndex?: number;
};

type TokenInfo = {
  raw: string;
  normalized: string;
  isStopWord: boolean;
};

function addCandidate(
  map: Map<string, Candidate>,
  term: string,
  score: number,
  sentenceIndex?: number,
) {
  const normalized = normalizeTermKey(term);
  if (!normalized || STOP_WORDS.has(normalized)) {
    return;
  }

  const existing = map.get(normalized);
  if (existing) {
    existing.score += score;
    if (existing.sentenceIndex === undefined && sentenceIndex !== undefined) {
      existing.sentenceIndex = sentenceIndex;
    }
    return;
  }

  map.set(normalized, {
    score,
    term: normalizeSpaces(term),
    sentenceIndex,
  });
}

function tokenizeWithMetadata(text: string): TokenInfo[] {
  const matches = text.match(/[A-Za-z][A-Za-z'-]*/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((rawToken) => {
      const normalized = normalizeWord(rawToken);
      return {
        raw: rawToken,
        normalized,
        isStopWord: STOP_WORDS.has(normalized),
      };
    })
    .filter((token) => token.normalized.length >= 2);
}

function addTitlePhraseCandidates(
  value: string,
  titleTokenSet: Set<string>,
  candidateMap: Map<string, Candidate>,
  sentences: string[],
) {
  const tokens = tokenizeWithMetadata(value);
  if (tokens.length < 2) {
    return;
  }

  const maxWindowSize = Math.min(4, tokens.length);
  for (let size = maxWindowSize; size >= 2; size -= 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const window = tokens.slice(start, start + size);
      if (window[0].isStopWord || window[window.length - 1].isStopWord) {
        continue;
      }

      const hasDisallowedMiddleStop = window.slice(1, -1).some(
        (token) => token.isStopWord && !ALLOWED_CONNECTOR_WORDS.has(token.normalized),
      );
      if (hasDisallowedMiddleStop) {
        continue;
      }

      const normalizedParts = window.map((token) => token.normalized);
      const contentTokenCount = normalizedParts.filter(
        (part) => !STOP_WORDS.has(part) && part.length >= 4,
      ).length;
      if (contentTokenCount < 2) {
        continue;
      }

      const term = normalizeSpaces(window.map((token) => token.raw).join(" "));
      const titleOverlap = normalizedParts.filter((part) =>
        titleTokenSet.has(part),
      ).length;
      const sentenceIndex = sentenceIndexOfTerm(sentences, term);
      const score = 14 + size * 2 + contentTokenCount + titleOverlap * 1.5;
      addCandidate(candidateMap, term, score, sentenceIndex);
    }
  }
}

function collectCollocationCandidates(
  sentence: string,
  sentenceIndex: number,
  titleTokenSet: Set<string>,
  candidateMap: Map<string, Candidate>,
) {
  const tokens = tokenizeWithMetadata(sentence);
  const tokenCount = tokens.length;
  if (tokenCount < 2) {
    return;
  }

  for (let start = 0; start < tokenCount; start += 1) {
    for (let size = 2; size <= 4; size += 1) {
      const end = start + size;
      if (end > tokenCount) {
        break;
      }

      const window = tokens.slice(start, end);
      if (window[0].isStopWord || window[window.length - 1].isStopWord) {
        continue;
      }

      const hasDisallowedMiddleStop = window.slice(1, -1).some(
        (token) => token.isStopWord && !ALLOWED_CONNECTOR_WORDS.has(token.normalized),
      );
      if (hasDisallowedMiddleStop) {
        continue;
      }

      const stopWordCount = window.filter((token) => token.isStopWord).length;
      if (stopWordCount > 1) {
        continue;
      }

      const contentTokenCount = window.filter(
        (token) => !token.isStopWord && token.normalized.length >= 4,
      ).length;
      if (contentTokenCount < 2) {
        continue;
      }

      const normalizedParts = window.map((token) => token.normalized);
      if (new Set(normalizedParts).size === 1) {
        continue;
      }

      const term = normalizeSpaces(window.map((token) => token.raw).join(" "));
      const titleOverlap = normalizedParts.filter((part) =>
        titleTokenSet.has(part),
      ).length;
      const score =
        4.5 +
        size * 1.8 +
        contentTokenCount * 0.6 +
        titleOverlap * 1.5 +
        (sentenceIndex === 0 ? 0.5 : 0);

      addCandidate(candidateMap, term, score, sentenceIndex + 1);
    }
  }
}

function collectCandidates(title: string, topicLabel: string, passage: string): Candidate[] {
  const sentences = splitPassageIntoSentences(passage);
  const candidateMap = new Map<string, Candidate>();
  const titleTokens = tokenize(`${title} ${topicLabel}`);
  const titleTokenSet = new Set(titleTokens);

  addTitlePhraseCandidates(title, titleTokenSet, candidateMap, sentences);
  addTitlePhraseCandidates(topicLabel, titleTokenSet, candidateMap, sentences);

  for (const titleToken of titleTokens) {
    addCandidate(
      candidateMap,
      titleToken,
      4,
      sentenceIndexOfTerm(sentences, titleToken),
    );
  }

  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const sentence = sentences[sentenceIndex];
    const tokens = tokenize(sentence);

    collectCollocationCandidates(
      sentence,
      sentenceIndex,
      titleTokenSet,
      candidateMap,
    );

    for (const token of tokens) {
      const score = (titleTokenSet.has(token) ? 3 : 1) + Math.min(token.length / 10, 1);
      addCandidate(candidateMap, token, score, sentenceIndex + 1);
    }
  }

  return [...candidateMap.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if ((right.sentenceIndex ?? 99) !== (left.sentenceIndex ?? 99)) {
      return (left.sentenceIndex ?? 99) - (right.sentenceIndex ?? 99);
    }
    return right.term.length - left.term.length;
  });
}

export function generatePassageVocab(
  title: string,
  topicLabel: string,
  passage: string,
  maxItems: number = MAX_VOCAB_ITEMS,
): PassageVocabItem[] {
  const normalizedMaxItems = Number.isInteger(maxItems)
    ? Math.max(1, Math.min(10, maxItems))
    : MAX_VOCAB_ITEMS;
  const minimumCollocationItems = Math.min(
    Math.max(2, Math.ceil(normalizedMaxItems / 2)),
    normalizedMaxItems,
  );
  const sentences = splitPassageIntoSentences(passage);
  const candidates = collectCandidates(title, topicLabel, passage);
  const collocationCandidates = candidates.filter((candidate) =>
    normalizeTermKey(candidate.term).includes(" "),
  );
  const singleWordCandidates = candidates.filter(
    (candidate) => !normalizeTermKey(candidate.term).includes(" "),
  );
  const vocab: PassageVocabItem[] = [];
  const seen = new Set<string>();

  const selectedTerms = new Set<string>();

  function tryAddCandidate(candidate: Candidate): boolean {
    if (vocab.length >= normalizedMaxItems) {
      return false;
    }

    const normalized = normalizeTermKey(candidate.term);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    const normalizedTokens = normalized.split(/\s+/);
    const overlapsSelectedCollocation =
      normalizedTokens.length === 1 &&
      [...selectedTerms].some((selected) =>
        selected.split(/\s+/).includes(normalizedTokens[0]),
      );
    if (overlapsSelectedCollocation) {
      return false;
    }

    const sentenceIndex =
      candidate.sentenceIndex ?? sentenceIndexOfTerm(sentences, candidate.term);
    const sentence =
      sentenceIndex !== undefined ? sentences[sentenceIndex - 1] : undefined;
    const meaningVi = resolveVietnameseMeaning(candidate.term);

    vocab.push({
      term: candidate.term,
      definition: buildDefinition(candidate.term, sentence, topicLabel),
      simple_meaning_en: buildDefinition(candidate.term, sentence, topicLabel),
      example_sentence_en:
        sentence && sentence.length > 0
          ? sentence
          : `${candidate.term} is an important phrase in this passage.`,
      meaning_vi: meaningVi,
      sentence_index: sentenceIndex,
    });
    seen.add(normalized);
    selectedTerms.add(normalized);
    return true;
  }

  for (const candidate of collocationCandidates) {
    if (vocab.length >= minimumCollocationItems) {
      break;
    }
    tryAddCandidate(candidate);
  }

  for (const candidate of collocationCandidates) {
    if (vocab.length >= normalizedMaxItems) {
      break;
    }
    tryAddCandidate(candidate);
  }

  for (const candidate of singleWordCandidates) {
    if (vocab.length >= normalizedMaxItems) {
      break;
    }
    tryAddCandidate(candidate);
  }

  return vocab;
}
