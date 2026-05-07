import readingMaterialBundle from "./reading-material-db.json";

export type QuestionType = "multiple_choice" | "true_false_not_given" | "sentence_completion" | "short_answer";

type RawQuestionType = "MCQ" | "TFNG";

interface RawReadingQuestion {
  id: number;
  type: RawQuestionType;
  prompt: string;
  options?: Record<string, string>;
}

interface RawAnswerKeyItem {
  question_id: number;
  answer: string;
  explanation: string;
}

interface RawReadingCard {
  id: number;
  band: string;
  question_type: RawQuestionType;
  topic: string;
  passage: string;
  questions: RawReadingQuestion[];
  answer_key: RawAnswerKeyItem[];
}

interface RawReadingMaterialBundle {
  version: string;
  exam: string;
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
  bundleTitle: `${bundle.exam} v${bundle.version}`,
  totalCards: bundle.cards.length,
  description: "Static IELTS Reading database using the v1.0 question/answer-key schema.",
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

function formatTfngAnswer(answer: string) {
  const normalized = answer.toUpperCase().replace(/_/g, " ");
  if (normalized === "TRUE") return "True";
  if (normalized === "FALSE") return "False";
  if (normalized === "NOT GIVEN") return "Not Given";
  return answer;
}

function formatOptions(options: Record<string, string> | undefined) {
  if (!options) return undefined;
  return Object.entries(options).map(([letter, value]) => `${letter}) ${value}`);
}

function correctAnswerForQuestion(question: RawReadingQuestion, answer: string) {
  if (question.type === "MCQ") {
    const optionText = question.options?.[answer];
    return optionText ? `${answer}) ${optionText}` : answer;
  }

  return formatTfngAnswer(answer);
}

function acceptedAnswers(answer: string, rawAnswer: string) {
  return Array.from(new Set([answer, rawAnswer, formatTfngAnswer(rawAnswer)]));
}

function questionType(type: RawQuestionType): QuestionType {
  return type === "MCQ" ? "multiple_choice" : "true_false_not_given";
}

function questionOptions(question: RawReadingQuestion) {
  if (question.type === "MCQ") return formatOptions(question.options);
  return ["True", "False", "Not Given"];
}

function questionEvidence(passage: string, answer: string, explanation: string, prompt: string) {
  if (answer.toUpperCase().replace(/_/g, " ") === "NOT GIVEN") {
    return [];
  }

  const sentences = splitSentences(passage);
  const normalizedExplanation = normalizeAnswer(explanation);

  const explanationMatch = sentences.find((sentence) => {
    const normalizedSentence = normalizeAnswer(sentence);
    return normalizedSentence.length > 0 && normalizedExplanation.includes(normalizedSentence);
  });

  if (explanationMatch) {
    return [explanationMatch];
  }

  const keywordSource = `${prompt} ${explanation}`;
  const keywords = normalizeAnswer(keywordSource)
    .split(" ")
    .filter((word) => word.length > 4 && !["false", "true", "given", "passage", "stated", "directly"].includes(word));

  const keywordMatch = sentences.find((sentence) => {
    const normalizedSentence = normalizeAnswer(sentence);
    return keywords.some((word) => normalizedSentence.includes(word));
  });

  return keywordMatch ? [keywordMatch] : [];
}

export const readingMaterialDatabase: ReadingCard[] = bundle.cards.map((card) => {
  const answerKeyByQuestionId = new Map(
    card.answer_key.map((answerKey) => [answerKey.question_id, answerKey]),
  );

  return {
    id: `reading-card-${card.id}`,
    title: card.topic,
    difficulty: bandToDifficulty(card.band),
    topic: card.question_type,
    band: card.band,
    passage: card.passage,
    questions: card.questions.map((question) => {
      const answerKey = answerKeyByQuestionId.get(question.id);
      if (!answerKey) {
        throw new Error(`Missing answer key for card ${card.id}, question ${question.id}`);
      }

      const correctAnswer = correctAnswerForQuestion(question, answerKey.answer);

      return {
        id: `reading-card-${card.id}-q${question.id}`,
        type: questionType(question.type),
        text: question.prompt,
        options: questionOptions(question),
        correctAnswer,
        acceptedAnswers: acceptedAnswers(correctAnswer, answerKey.answer),
        explanation: answerKey.explanation,
        evidence: questionEvidence(card.passage, answerKey.answer, answerKey.explanation, question.prompt),
      };
    }),
  };
});

export const readingCards = readingMaterialDatabase;

export function getShuffledReadingCards(): ReadingCard[] {
  const shuffled = [...readingMaterialDatabase];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function getRandomReadingCards(count: number): ReadingCard[] {
  if (readingMaterialDatabase.length === 0) {
    return [];
  }

  const shuffled = getShuffledReadingCards();

  if (count <= shuffled.length) {
    return shuffled.slice(0, count);
  }

  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
}
