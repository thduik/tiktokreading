import readingMaterialBundle from "./reading-material-db.json";

export type QuestionType = "multiple_choice" | "true_false_not_given" | "sentence_completion" | "short_answer";

interface RawReadingQuestion {
  number: number;
  type: QuestionType;
  question: string;
  options?: Record<string, string>;
  correctAnswer: string;
}

interface RawReadingCard {
  id: number;
  band: string;
  topic: string;
  title: string;
  passage: string;
  questions: RawReadingQuestion[];
}

interface RawReadingMaterialBundle {
  bundleTitle: string;
  totalCards: number;
  description: string;
  cards: RawReadingCard[];
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  evidence: string[];
}

export interface ReadingCard {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  band: string;
  passage: string;
  questions: Question[];
}

const bundle = readingMaterialBundle as RawReadingMaterialBundle;

export const readingMaterialMetadata = {
  bundleTitle: bundle.bundleTitle,
  totalCards: bundle.totalCards,
  description: bundle.description,
};

function bandToDifficulty(band: string): ReadingCard["difficulty"] {
  const numericBand = Number.parseFloat(band);
  if (numericBand >= 7.5) return "Hard";
  if (numericBand >= 6.5) return "Medium";
  return "Easy";
}

function splitSentences(passage: string) {
  return passage.match(/[^.!?]+[.!?]/g)?.map((sentence) => sentence.trim()) ?? [passage];
}

function normalizeAnswer(answer: string) {
  return answer
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acceptedAnswers(answer: string) {
  const answers = new Set<string>();
  answers.add(answer);

  const withoutParentheses = answer.replace(/\s*\([^)]*\)/g, "").trim();
  if (withoutParentheses) {
    answers.add(withoutParentheses);
  }

  const parenthetical = answer.match(/\((?:or\s+)?([^)]*)\)/i)?.[1]?.trim();
  if (parenthetical) {
    answers.add(parenthetical);
  }

  return Array.from(answers);
}

function questionEvidence(passage: string, correctAnswer: string, question: string) {
  const sentences = splitSentences(passage);
  const candidates = acceptedAnswers(correctAnswer)
    .map((answer) => normalizeAnswer(answer))
    .filter(Boolean);

  const answerMatch = sentences.find((sentence) => {
    const normalizedSentence = normalizeAnswer(sentence);
    return candidates.some((answer) => normalizedSentence.includes(answer));
  });

  if (answerMatch) {
    return [answerMatch];
  }

  const questionKeywords = normalizeAnswer(question)
    .split(" ")
    .filter((word) => word.length > 4);

  const keywordMatch = sentences.find((sentence) => {
    const normalizedSentence = normalizeAnswer(sentence);
    return questionKeywords.some((word) => normalizedSentence.includes(word));
  });

  return [keywordMatch ?? sentences[0]];
}

function formatOptions(options: Record<string, string> | undefined) {
  if (!options) return undefined;
  return Object.entries(options).map(([letter, value]) => `${letter}) ${value}`);
}

function correctAnswerForQuestion(question: RawReadingQuestion) {
  if (question.type === "multiple_choice") {
    const optionText = question.options?.[question.correctAnswer];
    return optionText ? `${question.correctAnswer}) ${optionText}` : question.correctAnswer;
  }

  return question.correctAnswer;
}

function explanationForQuestion(question: RawReadingQuestion, correctAnswer: string) {
  if (question.type === "multiple_choice") {
    return `The correct option is ${correctAnswer}.`;
  }

  if (question.type === "true_false_not_given") {
    return `The correct IELTS response is ${correctAnswer}.`;
  }

  return `The answer from the passage is: ${correctAnswer}.`;
}

export const readingMaterialDatabase: ReadingCard[] = bundle.cards.map((card) => ({
  id: `reading-card-${card.id}`,
  title: card.title,
  difficulty: bandToDifficulty(card.band),
  topic: card.topic,
  band: card.band,
  passage: card.passage,
  questions: card.questions.map((question) => {
    const correctAnswer = correctAnswerForQuestion(question);

    return {
      id: `reading-card-${card.id}-q${question.number}`,
      type: question.type,
      text: question.question,
      options:
        question.type === "multiple_choice"
          ? formatOptions(question.options)
          : question.type === "true_false_not_given"
            ? ["True", "False", "Not Given"]
            : undefined,
      correctAnswer,
      acceptedAnswers: acceptedAnswers(correctAnswer),
      explanation: explanationForQuestion(question, correctAnswer),
      evidence: questionEvidence(card.passage, correctAnswer, question.question),
    };
  }),
}));

export const readingCards = readingMaterialDatabase;

export function getRandomReadingCards(count: number): ReadingCard[] {
  if (readingMaterialDatabase.length === 0) {
    return [];
  }

  const shuffled = [...readingMaterialDatabase];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (count <= shuffled.length) {
    return shuffled.slice(0, count);
  }

  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
}
