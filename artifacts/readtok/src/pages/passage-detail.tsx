import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Share2,
  Volume2,
  XCircle,
} from "lucide-react";
import {
  fetchPassageDetail,
  type PassageAnswerKey,
  type PassageDetail,
  type PassageQuestion,
  type QuestionPayload,
} from "@/lib/passages-api";
import { useAppState } from "@/hooks/use-app-state";

function toQuestionKey(questionId: number) {
  return String(questionId);
}

function extractInstructionLabel(payload: QuestionPayload): string | null {
  const instruction = payload.instruction_label;
  if (typeof instruction === "string" && instruction.length > 0) {
    return instruction;
  }

  const maxWords = payload.max_words;
  if (typeof maxWords === "number" && Number.isFinite(maxWords)) {
    return `NO MORE THAN ${maxWords} WORDS`;
  }

  return null;
}

function answerMapByQuestionId(answerKey: PassageAnswerKey[]) {
  return new Map(answerKey.map((item) => [item.question_id, item]));
}

function normalizeForCompare(value: string, caseSensitive: boolean) {
  const compact = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? compact : compact.toLowerCase();
}

function wordCount(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

function isQuestionCorrect(
  question: PassageQuestion,
  answerKey: PassageAnswerKey | undefined,
  userAnswer: string,
) {
  if (!answerKey) {
    return false;
  }

  if (!userAnswer.trim()) {
    return false;
  }

  if (answerKey.answer_type === "label" || answerKey.answer_type === "option_key") {
    return (
      normalizeForCompare(userAnswer, false) ===
      normalizeForCompare(answerKey.answer_value, false)
    );
  }

  const caseSensitive = question.payload.case_sensitive === true;
  const maxWords = question.payload.max_words;
  if (
    typeof maxWords === "number" &&
    Number.isFinite(maxWords) &&
    wordCount(userAnswer) > maxWords
  ) {
    return false;
  }

  const acceptedValues =
    Array.isArray(answerKey.accepted_values) && answerKey.accepted_values.length > 0
      ? answerKey.accepted_values
      : [answerKey.answer_value];

  const normalizedUserAnswer = normalizeForCompare(userAnswer, caseSensitive);
  return acceptedValues.some(
    (acceptedValue) =>
      normalizeForCompare(acceptedValue, caseSensitive) === normalizedUserAnswer,
  );
}

function TopBadgeRow({ passage }: { passage: PassageDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-primary">
        IELTS READING
      </span>
      <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white/80">
        {passage.question_set_type_label}
      </span>
      <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white/80">
        Band {passage.band_label}
      </span>
    </div>
  );
}

function AudioButton({
  speaking,
  onClick,
}: {
  speaking: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`h-12 w-12 rounded-full border text-white transition-colors ${
        speaking
          ? "border-primary/60 bg-primary/15"
          : "border-white/15 bg-white/[0.03] hover:border-white/30"
      }`}
      onClick={onClick}
      aria-label={speaking ? "Stop audio" : "Read passage"}
    >
      <Volume2 className="mx-auto h-5 w-5" />
    </button>
  );
}

function PassageHeader({ passage }: { passage: PassageDetail }) {
  return (
    <header className="mt-5">
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
        {passage.title}
      </h1>
      <p className="mt-2 text-sm text-white/50">{passage.topic_label}</p>
    </header>
  );
}

function PassageText({ text }: { text: string }) {
  return (
    <article className="mt-6 rounded-3xl border border-white/10 bg-[#090a0a] px-5 py-6">
      <p className="font-serif text-[1.95rem] leading-[1.72] text-white/92 max-[640px]:text-[1.08rem] max-[640px]:leading-9">
        {text}
      </p>
    </article>
  );
}

function QuestionTypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-primary">
      {label}
    </span>
  );
}

function McqOptions({
  options,
  answer,
  onChange,
  disabled,
}: {
  options: Array<{ key: string; text: string }>;
  answer: string;
  onChange: (nextAnswer: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((option) => {
        const selected = answer === option.key;
        return (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.key)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
              selected
                ? "border-primary/55 bg-primary/12 text-white"
                : "border-white/12 bg-white/[0.03] text-white/86 hover:border-white/30"
            } ${disabled ? "cursor-default" : ""}`}
          >
            <span className="font-semibold">{option.key})</span> {option.text}
          </button>
        );
      })}
    </div>
  );
}

function TfngSelector({
  answer,
  onChange,
  disabled,
}: {
  answer: string;
  onChange: (nextAnswer: string) => void;
  disabled: boolean;
}) {
  const choices = ["TRUE", "FALSE", "NOT GIVEN"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {choices.map((choice) => {
        const selected = answer === choice;
        return (
          <button
            key={choice}
            type="button"
            disabled={disabled}
            onClick={() => onChange(choice)}
            className={`rounded-xl border px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
              selected
                ? "border-primary/55 bg-primary/14 text-primary"
                : "border-white/12 bg-white/[0.03] text-white/78 hover:border-white/30"
            } ${disabled ? "cursor-default" : ""}`}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}

function TextAnswerInput({
  answer,
  placeholder,
  onChange,
  disabled,
}: {
  answer: string;
  placeholder: string;
  onChange: (nextAnswer: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      value={answer}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-12 w-full rounded-2xl border border-white/12 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-primary/50"
    />
  );
}

function ReviewExplanationBlock({
  isCorrect,
  userAnswer,
  answerKey,
}: {
  isCorrect: boolean;
  userAnswer: string;
  answerKey: PassageAnswerKey | undefined;
}) {
  return (
    <div
      className={`mt-3 rounded-2xl border px-4 py-3 ${
        isCorrect
          ? "border-emerald-400/35 bg-emerald-500/10"
          : "border-rose-400/35 bg-rose-500/10"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {isCorrect ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <XCircle className="h-4 w-4 text-rose-300" />
        )}
        <span>{isCorrect ? "Correct" : "Incorrect"}</span>
      </div>
      <p className="mt-2 text-sm text-white/85">
        <span className="text-white/60">Your answer:</span>{" "}
        {userAnswer.trim() ? userAnswer : "No answer"}
      </p>
      <p className="mt-1 text-sm text-white/90">
        <span className="text-white/60">Correct answer:</span>{" "}
        {answerKey?.answer_value ?? "N/A"}
      </p>
      {answerKey?.explanation && (
        <p className="mt-2 text-sm leading-relaxed text-white/78">
          {answerKey.explanation}
        </p>
      )}
    </div>
  );
}

function FloatingActionButtons({
  saved,
  onSaveToggle,
  onShare,
}: {
  saved: boolean;
  onSaveToggle: () => void;
  onShare: () => void;
}) {
  return (
    <div className="fixed right-4 top-[58%] z-40 flex -translate-y-1/2 flex-col gap-3">
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white"
        onClick={onSaveToggle}
        aria-label={saved ? "Unsave passage" : "Save passage"}
      >
        {saved ? (
          <BookmarkCheck className="h-6 w-6 text-primary" />
        ) : (
          <Bookmark className="h-6 w-6" />
        )}
      </button>
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white"
        onClick={onShare}
        aria-label="Share passage"
      >
        <Share2 className="h-6 w-6" />
      </button>
    </div>
  );
}

function readMcqOptions(payload: QuestionPayload) {
  const rawOptions = payload.options;
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions
    .map((option) => {
      if (
        typeof option !== "object" ||
        option === null ||
        !("key" in option) ||
        !("text" in option)
      ) {
        return null;
      }

      const key = (option as { key?: unknown }).key;
      const text = (option as { text?: unknown }).text;

      if (typeof key !== "string" || typeof text !== "string") {
        return null;
      }

      return { key, text };
    })
    .filter((option): option is { key: string; text: string } => option !== null);
}

function QuestionBlock({
  question,
  answer,
  answerKey,
  reviewMode,
  onAnswerChange,
}: {
  question: PassageQuestion;
  answer: string;
  answerKey: PassageAnswerKey | undefined;
  reviewMode: boolean;
  onAnswerChange: (nextAnswer: string) => void;
}) {
  const instructionLabel = extractInstructionLabel(question.payload);
  const isCorrect = isQuestionCorrect(question, answerKey, answer);
  const mcqOptions = readMcqOptions(question.payload);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center gap-2">
        <p className="text-[1.6rem] font-bold tracking-tight text-primary">
          Q{question.order_index}.
        </p>
        <QuestionTypeBadge label={question.question_type_label} />
      </div>

      <p className="mt-3 text-[1.12rem] font-medium leading-snug text-white/95">
        {question.prompt}
      </p>

      {instructionLabel && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary/90">
          {instructionLabel}
        </p>
      )}

      <div className="mt-3">
        {question.question_type_index === "mcq" && (
          <McqOptions
            options={mcqOptions}
            answer={answer}
            onChange={onAnswerChange}
            disabled={reviewMode}
          />
        )}

        {question.question_type_index === "tfng" && (
          <TfngSelector
            answer={answer}
            onChange={onAnswerChange}
            disabled={reviewMode}
          />
        )}

        {(question.question_type_index === "sentence_completion" ||
          question.question_type_index === "short_answer") && (
          <TextAnswerInput
            answer={answer}
            onChange={onAnswerChange}
            disabled={reviewMode}
            placeholder="Type your answer"
          />
        )}
      </div>

      {reviewMode && (
        <ReviewExplanationBlock
          isCorrect={isCorrect}
          userAnswer={answer}
          answerKey={answerKey}
        />
      )}
    </section>
  );
}

export default function PassageDetailPage() {
  const [, params] = useRoute("/passages/:id");
  const passageId = params?.id ?? "";
  const { isCardSaved, toggleSaveCard, updateStats } = useAppState();

  const [passage, setPassage] = useState<PassageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewMode, setReviewMode] = useState(false);
  const [hasTrackedAttempt, setHasTrackedAttempt] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setReviewMode(false);
    setAnswers({});
    setHasTrackedAttempt(false);

    async function loadPassage() {
      try {
        const detail = await fetchPassageDetail(passageId, true);
        if (!cancelled) {
          setPassage(detail);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load passage.";
          setError(message);
          setPassage(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (passageId) {
      loadPassage();
    }

    return () => {
      cancelled = true;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [passageId]);

  const answerByQuestionId = useMemo(
    () => answerMapByQuestionId(passage?.answer_key ?? []),
    [passage?.answer_key],
  );

  const isSaved = passage ? isCardSaved(passage.id) : false;

  const answeredCount = passage
    ? passage.questions.filter((question) => {
        const value = answers[toQuestionKey(question.id)];
        return typeof value === "string" && value.trim().length > 0;
      }).length
    : 0;

  const correctCount = passage
    ? passage.questions.reduce((count, question) => {
        const answerKey = answerByQuestionId.get(question.id);
        const userAnswer = answers[toQuestionKey(question.id)] ?? "";
        return count + (isQuestionCorrect(question, answerKey, userAnswer) ? 1 : 0);
      }, 0)
    : 0;

  function handleAnswerChange(questionId: number, nextAnswer: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [toQuestionKey(questionId)]: nextAnswer,
    }));
  }

  function handleSubmitForReview() {
    if (!passage) {
      return;
    }

    setReviewMode(true);
    if (!hasTrackedAttempt) {
      updateStats(correctCount, passage.questions.length);
      setHasTrackedAttempt(true);
    }
  }

  function handleRetry() {
    setReviewMode(false);
    setAnswers({});
    setHasTrackedAttempt(false);
  }

  function toggleSpeech() {
    if (!passage || !("speechSynthesis" in window)) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(passage.passage);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function sharePassage() {
    if (!passage) {
      return;
    }

    const url = window.location.href;
    const title = `${passage.exam_label}: ${passage.title}`;

    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    await navigator.clipboard.writeText(url);
  }

  if (isLoading) {
    return (
      <div className="min-h-full w-full px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-white/[0.05]" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/[0.05]" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  if (error || !passage) {
    return (
      <div className="min-h-full w-full px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-sm text-red-100">
          {error ?? "Passage not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full px-4 pb-28 pt-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <TopBadgeRow passage={passage} />
          <AudioButton speaking={isSpeaking} onClick={toggleSpeech} />
        </div>

        <PassageHeader passage={passage} />
        <PassageText text={passage.passage} />

        <section className="mt-6 space-y-4">
          {passage.questions.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              answer={answers[toQuestionKey(question.id)] ?? ""}
              answerKey={answerByQuestionId.get(question.id)}
              reviewMode={reviewMode}
              onAnswerChange={(nextAnswer) =>
                handleAnswerChange(question.id, nextAnswer)
              }
            />
          ))}
        </section>

        <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>
              Answered {answeredCount} / {passage.questions.length}
            </span>
            {reviewMode && (
              <span className="font-semibold text-primary">
                Score: {correctCount}/{passage.questions.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={reviewMode ? handleRetry : handleSubmitForReview}
            className="mt-3 h-12 w-full rounded-2xl bg-primary text-sm font-bold tracking-[0.08em] text-black transition-colors hover:bg-primary/85"
          >
            {reviewMode ? "PRACTICE AGAIN" : "SUBMIT ANSWERS"}
          </button>
        </div>
      </div>

      <FloatingActionButtons
        saved={isSaved}
        onSaveToggle={() => toggleSaveCard(passage.id)}
        onShare={sharePassage}
      />
    </div>
  );
}
