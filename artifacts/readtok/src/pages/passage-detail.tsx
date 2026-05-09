import {
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { Link, useRoute, useSearch } from "wouter";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  House,
  Maximize2,
  Minimize2,
  Trophy,
  Volume2,
  XCircle,
} from "lucide-react";
import { RankPlate } from "@/components/rank-plate";
import {
  fetchPassageDetail,
  fetchPassageList,
  type PassageAnswerKey,
  type PassageDetail,
  type PassageQuestion,
  type PassageSentence,
  type PassageVocabItem,
  type PassageReportType,
  type QuestionPayload,
  submitPassageReport,
} from "@/lib/passages-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppState } from "@/hooks/use-app-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { playAnswerFeedback } from "@/lib/feedback-effects";
import { getRankPlateData, type RankPlateData } from "@/lib/rank-visual";
import type { AchievementDefinition } from "@/lib/achievements";
import { formatLocalDayKey, getDailyGoalProgress } from "@/lib/daily-goal";
import { submitRankedAnswer } from "@/lib/profile-api";

function toQuestionKey(questionId: number) {
  return String(questionId);
}

function toRankFeedbackKey(passageId: string, questionId: number) {
  return `${passageId}:${questionId}`;
}

type RankFeedbackState = {
  isPending: boolean;
  rankedPointDelta: number | null;
};

type FeedRuntimeSession = {
  passages: PassageDetail[];
  currentIndex: number;
  answersByPassageId: Record<string, Record<string, string>>;
  revealedByPassageId: Record<string, Record<string, boolean>>;
  feedIds: string[];
  listOffset: number;
  feedScrollLeft: number;
};

let feedRuntimeSession: FeedRuntimeSession | null = null;

const PASSAGE_REPORT_SESSION_KEY_PREFIX = "readtok_reported_passage:";
const PASSAGE_REPORT_TYPE_OPTIONS: Array<{
  value: PassageReportType;
  label: string;
}> = [
  { value: "wrong_answer_key", label: "Wrong answer key" },
  { value: "question_unclear", label: "Question unclear" },
  { value: "passage_text_issue", label: "Passage text issue" },
  { value: "formatting_issue", label: "Formatting issue" },
  { value: "other", label: "Other" },
];

function passageReportSessionKey(passageId: string) {
  return `${PASSAGE_REPORT_SESSION_KEY_PREFIX}${passageId}`;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeVocabTerm(term: string) {
  return term.replace(/^[*\-\u2022]+\s*/, "").trim();
}

function AchievementUnlockedToast({
  achievement,
}: {
  achievement: AchievementDefinition;
}) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-4 z-50 w-[min(92vw,360px)] -translate-x-1/2 rounded-lg border border-primary/45 bg-card/95 px-4 py-3 shadow-xl backdrop-blur"
      data-testid="toast-achievement-unlocked"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/15">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Achievement Unlocked
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {achievement.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
}

type TextRange = {
  start: number;
  end: number;
};

type SentenceVocabMatch = {
  range: TextRange;
  item: PassageVocabItem;
};

type SentenceSegment = {
  text: string;
  key: string;
  isEvidence: boolean;
  vocabItem?: PassageVocabItem;
};

function findFirstTextRange(sentence: string, highlightText?: string): TextRange | null {
  if (!highlightText || highlightText.trim().length === 0) {
    return null;
  }

  const pattern = new RegExp(`(${escapeRegExp(highlightText)})`, "i");
  const match = sentence.match(pattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const end = start + match[0].length;
  if (start < 0 || end <= start) {
    return null;
  }

  return { start, end };
}

function findSentenceVocabMatches(
  sentence: string,
  sentenceIndex: number,
  vocabItems: PassageVocabItem[],
) {
  const candidates = vocabItems
    .filter(
      (item) =>
        normalizeVocabTerm(item.term).length > 0 &&
        (item.sentence_index === undefined || item.sentence_index === sentenceIndex),
    )
    .sort(
      (left, right) =>
        normalizeVocabTerm(right.term).length - normalizeVocabTerm(left.term).length,
    );

  const matches: SentenceVocabMatch[] = [];

  for (const item of candidates) {
    const normalizedTerm = normalizeVocabTerm(item.term);
    const pattern = new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "gi");
    let currentMatch: RegExpExecArray | null = pattern.exec(sentence);

    while (currentMatch) {
      const matchedText = currentMatch[0];
      const start = currentMatch.index;
      const end = start + matchedText.length;
      const overlapsExisting = matches.some(
        (existingMatch) => start < existingMatch.range.end && end > existingMatch.range.start,
      );

      if (!overlapsExisting && start >= 0 && end > start) {
        matches.push({
          range: { start, end },
          item,
        });
      }

      currentMatch = pattern.exec(sentence);
    }
  }

  return matches.sort((left, right) => left.range.start - right.range.start);
}

function buildSentenceSegments({
  sentence,
  sentenceIndex,
  highlightText,
  vocabItems,
}: {
  sentence: string;
  sentenceIndex: number;
  highlightText?: string;
  vocabItems: PassageVocabItem[];
}) {
  const evidenceRange = findFirstTextRange(sentence, highlightText);
  const vocabMatches = findSentenceVocabMatches(sentence, sentenceIndex, vocabItems);
  const boundaries = new Set<number>([0, sentence.length]);

  if (evidenceRange) {
    boundaries.add(evidenceRange.start);
    boundaries.add(evidenceRange.end);
  }

  for (const match of vocabMatches) {
    boundaries.add(match.range.start);
    boundaries.add(match.range.end);
  }

  const orderedBoundaries = [...boundaries].sort((left, right) => left - right);
  const segments: SentenceSegment[] = [];

  for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
    const start = orderedBoundaries[index];
    const end = orderedBoundaries[index + 1];
    if (end <= start) {
      continue;
    }

    const text = sentence.slice(start, end);
    if (text.length === 0) {
      continue;
    }

    const vocabMatch = vocabMatches.find(
      (match) => start >= match.range.start && end <= match.range.end,
    );
    const isEvidence =
      evidenceRange !== null && start >= evidenceRange.start && end <= evidenceRange.end;

    segments.push({
      text,
      key: `${start}-${end}-${index}`,
      isEvidence,
      vocabItem: vocabMatch?.item,
    });
  }

  return segments;
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

function PassageTagRow({
  passage,
  dailyAttempted,
  answeredCount,
}: {
  passage: PassageDetail;
  dailyAttempted: number;
  answeredCount: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const questionFilterHref = `/list?filterMode=question_type&questionType=${encodeURIComponent(
    passage.question_set_type_index,
  )}`;
  const bandFilterHref = `/list?filterMode=band&band=${encodeURIComponent(
    String(passage.band_index),
  )}`;
  const dailyGoal = getDailyGoalProgress(dailyAttempted);
  const totalQuestions = Math.max(1, passage.questions.length);
  const completionPercent = Math.max(
    0,
    Math.min(100, Math.round((answeredCount / totalQuestions) * 100)),
  );

  return (
    <>
      <div className="relative flex min-w-0 flex-1 md:hidden">
        {!isExpanded ? (
          <div
            role="button"
            tabIndex={0}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden pr-10 text-left"
            onClick={() => setIsExpanded(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsExpanded(true);
              }
            }}
            aria-label="Expand reading status bar"
          >
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium text-muted-foreground">
              Band {passage.band_label}
            </span>
            <QuestionCompletionChip
              answeredCount={answeredCount}
              totalQuestions={totalQuestions}
              completionPercent={completionPercent}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pr-10">
            <Link
              href="/list"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
              aria-label="Go to passage list"
            >
              <House className="h-4 w-4" />
            </Link>
            <Link
              href={questionFilterHref}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {passage.question_set_type_label}
            </Link>
            <Link
              href={bandFilterHref}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Band {passage.band_label}
            </Link>
            <div className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground">
              <span className={dailyGoal.isComplete ? "text-secondary" : "text-primary"}>
                {dailyGoal.attemptedToday}/{dailyGoal.goal}
              </span>
              <span>Today</span>
              <span className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${
                    dailyGoal.isComplete ? "bg-secondary" : "bg-primary"
                  }`}
                  style={{ width: `${dailyGoal.progressPercent}%` }}
                />
              </span>
            </div>
            <QuestionCompletionChip
              answeredCount={answeredCount}
              totalQuestions={totalQuestions}
              completionPercent={completionPercent}
            />
          </div>
        )}

        <button
          type="button"
          className="absolute right-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-primary hover:text-primary"
          onClick={() => setIsExpanded((current) => !current)}
          aria-label={isExpanded ? "Collapse reading status bar" : "Expand reading status bar"}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="hidden min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] md:flex md:flex-wrap md:gap-2 md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <Link
          href="/list"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          aria-label="Go to passage list"
        >
          <House className="h-4 w-4" />
        </Link>
        <Link
          href={questionFilterHref}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:border-primary hover:text-primary md:px-3 md:text-[11px] md:tracking-[0.04em]"
        >
          {passage.question_set_type_label}
        </Link>
        <Link
          href={bandFilterHref}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[10px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:border-primary hover:text-primary md:px-3 md:text-[11px] md:tracking-[0.04em]"
        >
          Band {passage.band_label}
        </Link>
        <div className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground md:gap-2 md:px-3 md:text-[11px]">
          <span className={dailyGoal.isComplete ? "text-secondary" : "text-primary"}>
            {dailyGoal.attemptedToday}/{dailyGoal.goal}
          </span>
          <span>Today</span>
          <span className="h-1.5 w-8 overflow-hidden rounded-full bg-muted md:w-10">
            <span
              className={`block h-full rounded-full ${
                dailyGoal.isComplete ? "bg-secondary" : "bg-primary"
              }`}
              style={{ width: `${dailyGoal.progressPercent}%` }}
            />
          </span>
        </div>
        <QuestionCompletionChip
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          completionPercent={completionPercent}
        />
      </div>
    </>
  );
}

function QuestionCompletionChip({
  answeredCount,
  totalQuestions,
  completionPercent,
}: {
  answeredCount: number;
  totalQuestions: number;
  completionPercent: number;
}) {
  const completed = answeredCount >= totalQuestions;

  return (
    <div className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground md:gap-2 md:text-[11px]">
      <div
        className="relative h-5 w-5 rounded-full"
        style={{
          background: `conic-gradient(from 90deg, ${
            completed ? "hsl(var(--secondary))" : "hsl(var(--primary))"
          } ${completionPercent}%, hsl(var(--muted)) ${completionPercent}% 100%)`,
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-[3px] rounded-full bg-card" />
      </div>
      <span className={completed ? "text-secondary" : "text-foreground"}>
        {answeredCount}/{totalQuestions}
      </span>
      <span>Done</span>
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
      className={`h-12 w-12 shrink-0 rounded-lg border text-foreground transition-colors ${
        speaking
          ? "border-primary/60 bg-primary/15"
          : "border-border bg-card hover:border-primary"
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
    <header className="mt-0.5">
      <h1 className="passage-title-text text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground md:text-[1.42rem] lg:text-[1.48rem]">
        {passage.title}
      </h1>
    </header>
  );
}

function PassageText({
  sentences,
  highlightedSentenceMap,
  vocabItems,
  onVocabTap,
}: {
  sentences: PassageSentence[];
  highlightedSentenceMap: Record<number, { highlight_text?: string }>;
  vocabItems: PassageVocabItem[];
  onVocabTap: (item: PassageVocabItem) => void;
}) {
  return (
    <article className="mt-2 rounded-lg border border-border bg-background px-4 py-4">
      <p className="passage-body-text font-serif text-[1.85rem] leading-[1.68] text-foreground md:text-[1.42rem] md:leading-[1.56] lg:text-[1.5rem] max-[640px]:text-[1.04rem] max-[640px]:leading-8">
        {sentences.map((sentence, sentencePosition) => {
          const highlight = highlightedSentenceMap[sentence.sentence_index];
          const isHighlighted = Boolean(highlight);
          const segments = buildSentenceSegments({
            sentence: sentence.text,
            sentenceIndex: sentence.sentence_index,
            highlightText: highlight?.highlight_text,
            vocabItems,
          });

          return (
            <span
              key={sentence.sentence_index}
              className={isHighlighted ? "rounded bg-primary/15 px-1 py-0.5 text-foreground" : ""}
            >
              {segments.map((segment) => {
                if (segment.vocabItem) {
                  const vocabItem = segment.vocabItem;
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      className={`inline rounded-[2px] border-0 bg-transparent p-0 text-left font-semibold leading-[inherit] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 ${
                        segment.isEvidence
                          ? "bg-primary/25 px-0.5 text-foreground underline decoration-primary/70 underline-offset-2"
                          : "text-primary underline decoration-primary/45 underline-offset-2 hover:text-primary/85"
                      }`}
                      onClick={() => onVocabTap(vocabItem)}
                    >
                      {segment.text}
                    </button>
                  );
                }

                if (segment.isEvidence) {
                  return (
                    <span
                      key={segment.key}
                      className="rounded bg-primary/25 px-0.5 text-foreground"
                    >
                      {segment.text}
                    </span>
                  );
                }

                return <span key={segment.key}>{segment.text}</span>;
              })}
              {sentencePosition < sentences.length - 1 ? " " : ""}
            </span>
          );
        })}
      </p>
    </article>
  );
}

function VocabMeaningDialog({
  selectedVocab,
  onOpenChange,
}: {
  selectedVocab: PassageVocabItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const vietnameseMeaning =
    selectedVocab?.meaning_vi && selectedVocab.meaning_vi.trim().length > 0
      ? selectedVocab.meaning_vi
      : "Updating translation...";
  const englishMeaning =
    selectedVocab?.simple_meaning_en &&
    selectedVocab.simple_meaning_en.trim().length > 0
      ? selectedVocab.simple_meaning_en
      : selectedVocab?.definition && selectedVocab.definition.trim().length > 0
        ? selectedVocab.definition
      : "No definition available.";
  const exampleSentence =
    selectedVocab?.example_sentence_en &&
    selectedVocab.example_sentence_en.trim().length > 0
      ? selectedVocab.example_sentence_en
      : "No example sentence available.";

  return (
    <Dialog open={Boolean(selectedVocab)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-lg border border-border bg-card p-4 text-foreground">
        <div className="space-y-3 pr-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-primary/85">
            Vocabulary
          </p>
          <DialogTitle className="text-2xl font-semibold leading-tight text-foreground">
            {selectedVocab ? normalizeVocabTerm(selectedVocab.term) : ""}
          </DialogTitle>

          <div className="rounded-lg border border-border bg-muted px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary/90">
              Vietnamese
            </p>
            <p className="mt-1 text-sm text-foreground">{vietnameseMeaning}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary/90">
              Meaning (English)
            </p>
            <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {englishMeaning}
            </DialogDescription>
          </div>

          <div className="rounded-lg border border-border bg-muted px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary/90">
              Example Sentence
            </p>
            <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {exampleSentence}
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PassageReportDialog({
  open,
  reportType,
  isSubmitting,
  error,
  onOpenChange,
  onReportTypeChange,
  onSubmit,
}: {
  open: boolean;
  reportType: PassageReportType;
  isSubmitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onReportTypeChange: (nextType: PassageReportType) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-lg border border-border bg-card p-4 text-foreground">
        <div className="space-y-3 pr-7">
          <DialogTitle className="text-xl font-semibold leading-tight text-foreground">
            Report Passage
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Help us improve quality by reporting the main issue.
          </DialogDescription>

          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Issue type</span>
            <select
              value={reportType}
              onChange={(event) =>
                onReportTypeChange(event.target.value as PassageReportType)
              }
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            >
              {PASSAGE_REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-card">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`h-11 w-full rounded-lg border text-sm font-semibold transition-colors ${
              isSubmitting
                ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                : "border-primary/45 bg-primary/15 text-primary hover:bg-primary/25"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionTypeBadge({ label }: { label: string }) {
  return (
    <span className="question-pill-text rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-primary">
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
            className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
              selected
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border bg-muted text-foreground hover:border-primary"
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
            className={`rounded-lg border px-2 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
              selected
                ? "border-primary/55 bg-primary/15 text-primary"
                : "border-border bg-muted text-muted-foreground hover:border-primary hover:text-foreground"
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
      className="h-12 w-full rounded-lg border border-border bg-muted px-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary md:text-sm"
    />
  );
}

function ReviewExplanationBlock({
  isCorrect,
  userAnswer,
  answerKey,
  rankFeedback,
}: {
  isCorrect: boolean;
  userAnswer: string;
  answerKey: PassageAnswerKey | undefined;
  rankFeedback?: RankFeedbackState;
}) {
  const rankDeltaValue =
    rankFeedback && !rankFeedback.isPending ? rankFeedback.rankedPointDelta : null;
  const showRankDelta = rankDeltaValue !== null;

  const rankDeltaLabel = showRankDelta
    ? `${rankDeltaValue >= 0 ? "+" : ""}${rankDeltaValue} LP`
    : null;

  return (
    <div
      className={`mt-3 rounded-lg border px-4 py-3 ${
        isCorrect
          ? "border-secondary/35 bg-secondary/10"
          : "border-destructive/35 bg-destructive/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold md:text-[13px]">
          {isCorrect ? (
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span>{isCorrect ? "Correct" : "Incorrect"}</span>
        </div>
        {rankFeedback?.isPending ? (
          <span className="text-[11px] font-medium text-muted-foreground">LP updating...</span>
        ) : rankDeltaLabel ? (
          <span
            className={`text-[11px] font-semibold ${
              rankDeltaValue !== null && rankDeltaValue >= 0
                ? "text-secondary"
                : "text-destructive"
            }`}
          >
            {rankDeltaLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-foreground md:text-[13px]">
        <span className="text-muted-foreground">Your answer:</span>{" "}
        {userAnswer.trim() ? userAnswer : "No answer"}
      </p>
      <p className="mt-1 text-sm text-foreground md:text-[13px]">
        <span className="text-muted-foreground">Correct answer:</span>{" "}
        {answerKey?.answer_value ?? "N/A"}
      </p>
      {answerKey?.explanation && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[13px]">
          {answerKey.explanation}
        </p>
      )}
    </div>
  );
}

function AnswerReactionBadge({
  isCorrect,
  rankFeedback,
}: {
  isCorrect: boolean;
  rankFeedback?: RankFeedbackState;
}) {
  const rankDeltaValue =
    rankFeedback && !rankFeedback.isPending ? rankFeedback.rankedPointDelta : null;
  const rankDeltaLabel =
    rankDeltaValue === null
      ? null
      : `${rankDeltaValue >= 0 ? "+" : ""}${rankDeltaValue} LP`;

  return (
    <div className="mt-2 flex justify-end">
      <div
        className={`answer-reaction-pop inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
          isCorrect
            ? "border-secondary/45 bg-secondary/12 text-secondary"
            : "border-destructive/45 bg-destructive/12 text-destructive"
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        <span>{isCorrect ? "Correct" : "Missed"}</span>
        {rankFeedback?.isPending ? (
          <span className="text-muted-foreground">LP...</span>
        ) : rankDeltaLabel ? (
          <span>{rankDeltaLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function FloatingActionButtons({
  saved,
  reportDisabled,
  onSaveToggle,
  onReportClick,
}: {
  saved: boolean;
  reportDisabled: boolean;
  onSaveToggle: () => void;
  onReportClick: () => void;
}) {
  return (
    <div className="fixed right-4 top-[78%] z-40 flex -translate-y-1/2 flex-col gap-3">
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur transition-colors hover:border-primary"
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
        className={`flex h-14 w-14 items-center justify-center rounded-lg border backdrop-blur transition-colors ${
          reportDisabled
            ? "cursor-not-allowed border-border bg-card/60 text-muted-foreground"
            : "border-accent/45 bg-accent/12 text-accent hover:bg-accent/20"
        }`}
        onClick={onReportClick}
        disabled={reportDisabled}
        aria-label="Report passage issue"
      >
        <AlertTriangle className="h-6 w-6 text-current" />
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
  displayIndex,
  answer,
  answerKey,
  revealed,
  rankFeedback,
  onAnswerChange,
  onSubmitAnswer,
}: {
  question: PassageQuestion;
  displayIndex?: number;
  answer: string;
  answerKey: PassageAnswerKey | undefined;
  revealed: boolean;
  rankFeedback?: RankFeedbackState;
  onAnswerChange: (nextAnswer: string) => void;
  onSubmitAnswer: (nextAnswer?: string) => void;
}) {
  const instructionLabel = extractInstructionLabel(question.payload);
  const isCorrect = isQuestionCorrect(question, answerKey, answer);
  const mcqOptions = readMcqOptions(question.payload);
  const isTextQuestion =
    question.question_type_index === "sentence_completion" ||
    question.question_type_index === "short_answer";
  const canSubmitTextAnswer = answer.trim().length > 0 && !revealed;

  return (
    <section className="question-card-wrap rounded-lg border border-border bg-card px-3 py-3">
      <div className="flex items-center gap-2">
        <p className="question-index-text text-[1.35rem] font-bold tracking-tight text-primary md:text-[1.08rem]">
          Q{displayIndex ?? question.order_index}.
        </p>
        <QuestionTypeBadge label={question.question_type_label} />
      </div>

      <p className="question-prompt-text mt-2.5 text-[1rem] font-medium leading-snug text-foreground md:text-[0.9rem]">
        {question.prompt}
      </p>

      {instructionLabel && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary/90">
          {instructionLabel}
        </p>
      )}

      <div className="mt-2.5">
        {question.question_type_index === "mcq" && (
          <McqOptions
            options={mcqOptions}
            answer={answer}
            onChange={(nextAnswer) => {
              onAnswerChange(nextAnswer);
              onSubmitAnswer(nextAnswer);
            }}
            disabled={revealed}
          />
        )}

        {question.question_type_index === "tfng" && (
          <TfngSelector
            answer={answer}
            onChange={(nextAnswer) => {
              onAnswerChange(nextAnswer);
              onSubmitAnswer(nextAnswer);
            }}
            disabled={revealed}
          />
        )}

        {isTextQuestion && (
          <div className="space-y-2.5">
            <TextAnswerInput
              answer={answer}
              onChange={onAnswerChange}
              disabled={revealed}
              placeholder="Type your answer"
            />
            <button
              type="button"
              onClick={() => onSubmitAnswer()}
              disabled={!canSubmitTextAnswer}
              className={`answer-action-btn h-10 w-full rounded-lg border text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                canSubmitTextAnswer
                  ? "border-primary/45 bg-primary/15 text-primary hover:bg-primary/25"
                  : "cursor-not-allowed border-border bg-muted text-muted-foreground"
              }`}
            >
              {revealed ? "Submitted" : "Submit"}
            </button>
          </div>
        )}
      </div>

      {revealed && (
        <AnswerReactionBadge isCorrect={isCorrect} rankFeedback={rankFeedback} />
      )}

      {revealed && (
        <ReviewExplanationBlock
          isCorrect={isCorrect}
          userAnswer={answer}
          answerKey={answerKey}
          rankFeedback={rankFeedback}
        />
      )}
    </section>
  );
}

export default function PassageDetailPage() {
  const RANDOM_BATCH_SIZE = 10;
  const INITIAL_STACK_SIZE = 40;
  const PREFETCH_BATCH_SIZE = 30;
  const MAX_PREFETCH_COUNT = 3;
  const PREFETCH_TRIGGER_REMAINING = 20;
  const WINDOW_RADIUS = 10;
  const RANDOM_POOL_FETCH_LIMIT = 500;
  const RANDOM_POOL_STORAGE_KEY = "readtok_random_pool_ids_v2";
  const RANDOM_SHOWN_STORAGE_KEY = "readtok_random_shown_ids_v2";

  const [, params] = useRoute("/passages/:id");
  const search = useSearch();
  const startPassageId = new URLSearchParams(search).get("start")?.trim() ?? "";
  const routePassageId = (params?.id ?? startPassageId).trim();
  const {
    isCardSaved,
    toggleSaveCard,
    recordQuestionAttempt,
    recordSessionAnswerResult,
    recordRankedResult,
    recordPassageReport,
    feedbackPreferences,
    rankedIdentity,
    syncRankedIdentity,
    recentAchievementUnlocks,
    dismissRecentAchievementUnlocks,
    stats,
  } = useAppState();
  const isMobile = useIsMobile();
  const todayStats = stats.dailyStats[formatLocalDayKey()] ?? {
    attempted: 0,
    correct: 0,
  };
  const rankPlate = rankedIdentity
    ? getRankPlateData(
        rankedIdentity.rankedPoints,
        rankedIdentity.rankTiers,
        rankedIdentity.currentRank,
      )
    : stats.achievementProgress.currentLP > 0 ||
        stats.achievementProgress.currentRank !== "Bronze"
      ? getRankPlateData(
          stats.achievementProgress.currentLP,
          undefined,
          stats.achievementProgress.currentRank,
        )
      : null;

  const [passages, setPassages] = useState<PassageDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answersByPassageId, setAnswersByPassageId] = useState<
    Record<string, Record<string, string>>
  >({});
  const [revealedByPassageId, setRevealedByPassageId] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [rankFeedbackByQuestion, setRankFeedbackByQuestion] = useState<
    Record<string, RankFeedbackState>
  >({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<PassageVocabItem | null>(null);
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [listOffset, setListOffset] = useState(0);
  const [isAppending, setIsAppending] = useState(false);
  const [isArrowTapCooldown, setIsArrowTapCooldown] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] =
    useState<PassageReportType>("wrong_answer_key");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedPassageIds, setReportedPassageIds] = useState<Record<string, true>>({});
  const questionOrderByPassageRef = useRef<Record<string, number[]>>({});
  const prefetchCountRef = useRef(0);
  const desktopWheelMomentumTimeoutRef = useRef<number | null>(null);
  const desktopWheelGestureConsumedRef = useRef(false);
  const arrowTapCooldownTimeoutRef = useRef<number | null>(null);
  const mobileSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const mobileSwipeLockUntilRef = useRef(0);

  function hasReportedPassageInSession(passageId: string) {
    if (typeof window === "undefined") {
      return false;
    }
    return window.sessionStorage.getItem(passageReportSessionKey(passageId)) === "true";
  }

  function markPassageReportedInSession(passageId: string) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(passageReportSessionKey(passageId), "true");
    }
    setReportedPassageIds((currentState) => ({
      ...currentState,
      [passageId]: true,
    }));
  }

  function uniqueIds(ids: string[]) {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of ids) {
      if (id.length === 0 || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ordered.push(id);
    }
    return ordered;
  }

  function getDisplayQuestions(passage: PassageDetail) {
    const existingOrder = questionOrderByPassageRef.current[passage.id];
    const questionIds = passage.questions.map((question) => question.id);

    const hasValidCachedOrder =
      Array.isArray(existingOrder) &&
      existingOrder.length === questionIds.length &&
      existingOrder.every((id) => questionIds.includes(id));

    if (!hasValidCachedOrder) {
      const nextOrder = [...questionIds];
      for (let index = nextOrder.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const temp = nextOrder[index];
        nextOrder[index] = nextOrder[swapIndex];
        nextOrder[swapIndex] = temp;
      }
      questionOrderByPassageRef.current[passage.id] = nextOrder;
    }

    const order = questionOrderByPassageRef.current[passage.id] ?? questionIds;
    const byId = new Map(passage.questions.map((question) => [question.id, question]));

    return order
      .map((id) => byId.get(id))
      .filter((question): question is PassageQuestion => question !== undefined);
  }

  function shuffleIds(ids: string[]) {
    const cloned = [...ids];
    for (let index = cloned.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = cloned[index];
      cloned[index] = cloned[swapIndex];
      cloned[swapIndex] = temp;
    }
    return cloned;
  }

  function readIdArrayFromStorage(storageKey: string) {
    if (typeof window === "undefined") {
      return [];
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
    } catch {
      return [];
    }
  }

  function writeIdArrayToStorage(storageKey: string, ids: string[]) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(uniqueIds(ids)));
  }

  function selectRandomIdsFromPool({
    poolIds,
    alreadyShownIds,
    excludeIds,
    count,
  }: {
    poolIds: string[];
    alreadyShownIds: string[];
    excludeIds: string[];
    count: number;
  }) {
    const excludeSet = new Set(excludeIds);
    const shownSet = new Set(alreadyShownIds);

    const freshCandidates = poolIds.filter(
      (id) => !shownSet.has(id) && !excludeSet.has(id),
    );
    if (freshCandidates.length >= count) {
      return shuffleIds(freshCandidates).slice(0, count);
    }

    // Pool exhausted: reset shown memory while still avoiding currently loaded IDs.
    const resetCandidates = poolIds.filter((id) => !excludeSet.has(id));
    return shuffleIds(resetCandidates).slice(0, count);
  }

  async function fetchPassageDetailsSafe(ids: string[]) {
    const results = await Promise.allSettled(
      ids.map((id) => fetchPassageDetail(id, true)),
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<PassageDetail> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }

  function restoreFromRuntimeSession(targetPassageId?: string) {
    if (!feedRuntimeSession || feedRuntimeSession.passages.length === 0) {
      return false;
    }

    const {
      passages: cachedPassages,
      currentIndex: cachedCurrentIndex,
      answersByPassageId: cachedAnswers,
      revealedByPassageId: cachedRevealed,
      feedIds: cachedFeedIds,
      listOffset: cachedListOffset,
      feedScrollLeft: cachedFeedScrollLeft,
    } = feedRuntimeSession;

    const requestedIndex =
      targetPassageId && targetPassageId.length > 0
        ? cachedPassages.findIndex((passage) => passage.id === targetPassageId)
        : cachedCurrentIndex;

    if (targetPassageId && targetPassageId.length > 0 && requestedIndex < 0) {
      return false;
    }

    setPassages(cachedPassages);
    setFeedIds(cachedFeedIds);
    setListOffset(cachedListOffset);
    setAnswersByPassageId(cachedAnswers);
    setRevealedByPassageId(cachedRevealed);
    setCurrentIndex(
      Math.min(
        Math.max(requestedIndex >= 0 ? requestedIndex : cachedCurrentIndex, 0),
        cachedPassages.length - 1,
      ),
    );
    void cachedFeedScrollLeft;
    setIsLoading(false);
    setError(null);

    return true;
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPassages([]);
    setCurrentIndex(0);
    setAnswersByPassageId({});
    setRevealedByPassageId({});
    setSelectedVocab(null);
    prefetchCountRef.current = 0;

    if (restoreFromRuntimeSession(routePassageId)) {
      return () => {
        cancelled = true;
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      };
    }

    async function loadInitialPassages() {
      try {
        const poolResponse = await fetchPassageList({
          status: "active",
          limit: RANDOM_POOL_FETCH_LIMIT,
          offset: 0,
        });
        const poolIds = uniqueIds(poolResponse.items.map((item) => item.id));
        writeIdArrayToStorage(RANDOM_POOL_STORAGE_KEY, poolIds);

        const alreadyShown = readIdArrayFromStorage(RANDOM_SHOWN_STORAGE_KEY);
        const initialTargetCount = INITIAL_STACK_SIZE;
        const randomIds = selectRandomIdsFromPool({
          poolIds,
          alreadyShownIds: alreadyShown,
          excludeIds: [],
          count: initialTargetCount,
        });
        const initialIds = uniqueIds(
          routePassageId ? [routePassageId, ...randomIds] : randomIds,
        ).slice(0, initialTargetCount);

        const details = await fetchPassageDetailsSafe(initialIds);
        if (details.length === 0) {
          throw new Error("No passages could be loaded.");
        }

        if (
          routePassageId.length > 0 &&
          !details.some((detail) => detail.id === routePassageId)
        ) {
          const routePassage = await fetchPassageDetail(routePassageId, true);
          details.unshift(routePassage);
        }

        if (!cancelled) {
          setPassages(details);
          setFeedIds(poolIds);
          setListOffset(0);
          writeIdArrayToStorage(RANDOM_SHOWN_STORAGE_KEY, [
            ...alreadyShown,
            ...initialIds,
          ]);

          const requestedIndex =
            routePassageId.length > 0
              ? details.findIndex((item) => item.id === routePassageId)
              : 0;
          setCurrentIndex(requestedIndex >= 0 ? requestedIndex : 0);
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load passages.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialPassages();

    return () => {
      cancelled = true;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [routePassageId]);

  async function appendPassageBatch(targetCount = RANDOM_BATCH_SIZE) {
    if (isAppending) {
      return 0;
    }

    setIsAppending(true);
    try {
      let poolIds = feedIds;
      if (poolIds.length === 0) {
        const poolResponse = await fetchPassageList({
          status: "active",
          limit: RANDOM_POOL_FETCH_LIMIT,
          offset: 0,
        });
        poolIds = uniqueIds(poolResponse.items.map((item) => item.id));
        setFeedIds(poolIds);
        writeIdArrayToStorage(RANDOM_POOL_STORAGE_KEY, poolIds);
      }

      const loadedIds = passages.map((item) => item.id);
      const alreadyShown = readIdArrayFromStorage(RANDOM_SHOWN_STORAGE_KEY);
      const nextIds = selectRandomIdsFromPool({
        poolIds,
        alreadyShownIds: alreadyShown,
        excludeIds: loadedIds,
        count: targetCount,
      });
      if (nextIds.length === 0) {
        return 0;
      }

      const details = await fetchPassageDetailsSafe(nextIds);
      if (details.length === 0) {
        return 0;
      }
      const loadedSet = new Set(loadedIds);
      const dedupedDetails: PassageDetail[] = [];
      const localSeen = new Set<string>();
      for (const detail of details) {
        if (loadedSet.has(detail.id) || localSeen.has(detail.id)) {
          continue;
        }
        localSeen.add(detail.id);
        dedupedDetails.push(detail);
      }
      const addedCount = dedupedDetails.length;
      if (addedCount > 0) {
        setPassages((current) => [...current, ...dedupedDetails]);
      }
      writeIdArrayToStorage(RANDOM_SHOWN_STORAGE_KEY, [
        ...alreadyShown,
        ...nextIds,
      ]);
      return addedCount;
    } catch {
      // Ignore append failures and keep the current feed.
      return 0;
    } finally {
      setIsAppending(false);
    }
  }

  useEffect(() => {
    if (!isMobile || passages.length === 0) {
      return;
    }

    if (isAppending || prefetchCountRef.current >= MAX_PREFETCH_COUNT) {
      return;
    }

    const remaining = passages.length - 1 - currentIndex;
    if (remaining <= PREFETCH_TRIGGER_REMAINING) {
      void appendPassageBatch(PREFETCH_BATCH_SIZE).then((addedCount) => {
        if (addedCount > 0) {
          prefetchCountRef.current += 1;
        }
      });
    }
  }, [currentIndex, isAppending, isMobile, passages.length]);

  const activePassage = passages[currentIndex] ?? null;
  const isSaved = activePassage ? isCardSaved(activePassage.id) : false;
  const hasPrevPassage = currentIndex > 0;
  const hasNextPassage = currentIndex < passages.length - 1;
  const isReportDisabled = activePassage
    ? Boolean(reportedPassageIds[activePassage.id])
    : true;

  useEffect(() => {
    if (!activePassage) {
      return;
    }
    if (!hasReportedPassageInSession(activePassage.id)) {
      return;
    }
    setReportedPassageIds((currentState) => {
      if (currentState[activePassage.id]) {
        return currentState;
      }
      return {
        ...currentState,
        [activePassage.id]: true,
      };
    });
  }, [activePassage]);

  useEffect(() => {
    if (recentAchievementUnlocks.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(dismissRecentAchievementUnlocks, 3200);
    return () => window.clearTimeout(timeoutId);
  }, [dismissRecentAchievementUnlocks, recentAchievementUnlocks.length]);

  useEffect(() => {
    setIsReportDialogOpen(false);
    setReportError(null);
    setIsSubmittingReport(false);
  }, [activePassage?.id]);

  useEffect(() => {
    if (passages.length === 0) {
      return;
    }

    feedRuntimeSession = {
      passages,
      currentIndex,
      answersByPassageId,
      revealedByPassageId,
      feedIds,
      listOffset,
      feedScrollLeft: 0,
    };
  }, [
    passages,
    currentIndex,
    answersByPassageId,
    revealedByPassageId,
    feedIds,
    listOffset,
  ]);

  function moveToPreviousPassage() {
    if (!hasPrevPassage) {
      return;
    }
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }

  async function moveToNextPassage() {
    if (hasNextPassage) {
      setCurrentIndex((index) => Math.min(index + 1, passages.length - 1));
      return;
    }

    if (isAppending) {
      return;
    }

    const addedCount = await appendPassageBatch(PREFETCH_BATCH_SIZE);
    if (addedCount > 0) {
      setCurrentIndex((index) => index + 1);
    }
  }

  function startArrowTapCooldown() {
    if (arrowTapCooldownTimeoutRef.current !== null) {
      window.clearTimeout(arrowTapCooldownTimeoutRef.current);
    }
    setIsArrowTapCooldown(true);
    arrowTapCooldownTimeoutRef.current = window.setTimeout(() => {
      setIsArrowTapCooldown(false);
      arrowTapCooldownTimeoutRef.current = null;
    }, 1000);
  }

  function handlePreviousArrowTap() {
    if (isArrowTapCooldown || !hasPrevPassage) {
      return;
    }
    moveToPreviousPassage();
    startArrowTapCooldown();
  }

  function handleNextArrowTap() {
    if (isArrowTapCooldown) {
      return;
    }
    void moveToNextPassage();
    startArrowTapCooldown();
  }

  useEffect(() => {
    return () => {
      if (arrowTapCooldownTimeoutRef.current !== null) {
        window.clearTimeout(arrowTapCooldownTimeoutRef.current);
      }
      if (desktopWheelMomentumTimeoutRef.current !== null) {
        window.clearTimeout(desktopWheelMomentumTimeoutRef.current);
      }
    };
  }, []);

  function handleDesktopHorizontalScroll(event: WheelEvent<HTMLDivElement>) {
    if (isMobile) {
      return;
    }

    const horizontalDelta =
      Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;

    if (Math.abs(horizontalDelta) < 18) {
      return;
    }

    event.preventDefault();

    if (desktopWheelMomentumTimeoutRef.current !== null) {
      window.clearTimeout(desktopWheelMomentumTimeoutRef.current);
    }
    desktopWheelMomentumTimeoutRef.current = window.setTimeout(() => {
      desktopWheelGestureConsumedRef.current = false;
      desktopWheelMomentumTimeoutRef.current = null;
    }, 220);

    if (desktopWheelGestureConsumedRef.current) {
      return;
    }

    desktopWheelGestureConsumedRef.current = true;
    if (horizontalDelta > 0) {
      void moveToNextPassage();
      return;
    }
    moveToPreviousPassage();
  }

  function handleMobileSwipeStart(event: TouchEvent<HTMLDivElement>) {
    if (!isMobile || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    mobileSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleMobileSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    if (!isMobile) {
      return;
    }

    const start = mobileSwipeStartRef.current;
    mobileSwipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    const now = Date.now();
    if (now < mobileSwipeLockUntilRef.current) {
      return;
    }
    mobileSwipeLockUntilRef.current = now + 500;

    if (deltaX < 0) {
      void moveToNextPassage();
      return;
    }
    moveToPreviousPassage();
  }

  function getAnswerForQuestion(passageId: string, questionId: number) {
    return answersByPassageId[passageId]?.[toQuestionKey(questionId)] ?? "";
  }

  function isQuestionRevealed(passageId: string, questionId: number) {
    return Boolean(revealedByPassageId[passageId]?.[toQuestionKey(questionId)]);
  }

  function getAnsweredCountForPassage(passageId: string) {
    return Object.values(revealedByPassageId[passageId] ?? {}).filter(Boolean).length;
  }

  function handleAnswerChange(passageId: string, questionId: number, nextAnswer: string) {
    setAnswersByPassageId((currentAnswersByPassageId) => ({
      ...currentAnswersByPassageId,
      [passageId]: {
        ...(currentAnswersByPassageId[passageId] ?? {}),
        [toQuestionKey(questionId)]: nextAnswer,
      },
    }));
  }

  function revealAnswer(
    passageId: string,
    question: PassageQuestion,
    submittedAnswer: string,
  ) {
    if (!submittedAnswer.trim()) {
      return;
    }

    setRevealedByPassageId((currentState) => ({
      ...currentState,
      [passageId]: {
        ...(currentState[passageId] ?? {}),
        [toQuestionKey(question.id)]: true,
      },
    }));

    const targetPassage = passages.find((item) => item.id === passageId);
    const answerKey = targetPassage?.answer_key.find(
      (item) => item.question_id === question.id,
    );
    const isCorrect = isQuestionCorrect(question, answerKey, submittedAnswer);
    const xpDelta = isCorrect ? 10 : 2;
    recordQuestionAttempt(isCorrect, {
      questionType: question.question_type_index,
      band: targetPassage?.band_label ?? targetPassage?.band_index,
    });
    playAnswerFeedback(isCorrect, feedbackPreferences);

    const rankFeedbackKey = toRankFeedbackKey(passageId, question.id);
    setRankFeedbackByQuestion((currentState) => ({
      ...currentState,
      [rankFeedbackKey]: {
        isPending: true,
        rankedPointDelta: null,
      },
    }));

    void submitRankedAnswer({
      passageId,
      questionId: question.id,
      selectedAnswer: submittedAnswer,
      localDate: formatLocalDayKey(),
    })
      .then((result) => {
        recordRankedResult({
          rank: result.answer_result.rankAfter,
          rankedPointsAfter: result.answer_result.rankedPointsAfter,
          lpDelta: result.answer_result.rankedPointDelta,
        });
        recordSessionAnswerResult({
          isCorrect,
          xpDelta,
          lpDelta: result.answer_result.rankedPointDelta,
        });
        syncRankedIdentity(result.progress);
        setRankFeedbackByQuestion((currentState) => ({
          ...currentState,
          [rankFeedbackKey]: {
            isPending: false,
            rankedPointDelta: result.answer_result.rankedPointDelta,
          },
        }));
      })
      .catch(() => {
        // Ranking updates are best-effort; UI correctness flow should continue regardless.
        recordSessionAnswerResult({
          isCorrect,
          xpDelta,
          lpDelta: 0,
        });
        setRankFeedbackByQuestion((currentState) => ({
          ...currentState,
          [rankFeedbackKey]: {
            isPending: false,
            rankedPointDelta: null,
          },
        }));
      });
  }

  function buildHighlightedSentenceMap(passage: PassageDetail) {
    const map: Record<number, { highlight_text?: string }> = {};
    const revealedMap = revealedByPassageId[passage.id] ?? {};
    const answerByQuestionId = answerMapByQuestionId(passage.answer_key);

    for (const question of passage.questions) {
      const questionKey = toQuestionKey(question.id);
      if (!revealedMap[questionKey]) {
        continue;
      }

      const answer = answerByQuestionId.get(question.id);
      if (!answer || answer.answer_value.trim().toUpperCase() === "NOT GIVEN") {
        continue;
      }

      for (const evidence of answer.evidence ?? []) {
        if (
          Number.isInteger(evidence.sentence_index) &&
          evidence.sentence_index >= 1 &&
          evidence.sentence_index <= passage.passage_sentences.length
        ) {
          if (!map[evidence.sentence_index]) {
            map[evidence.sentence_index] = {};
          }
          if (!map[evidence.sentence_index].highlight_text && evidence.highlight_text) {
            map[evidence.sentence_index].highlight_text = evidence.highlight_text;
          }
        }
      }
    }

    return map;
  }

  function toggleSpeech(targetPassage: PassageDetail) {
    const passage = targetPassage;
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

  function openReportDialog() {
    if (!activePassage || isReportDisabled) {
      return;
    }
    setReportError(null);
    setIsReportDialogOpen(true);
  }

  async function handleSubmitPassageReport() {
    if (!activePassage || isReportDisabled || isSubmittingReport) {
      return;
    }

    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await submitPassageReport(activePassage.id, selectedReportType);
      markPassageReportedInSession(activePassage.id);
      recordPassageReport();
      setIsReportDialogOpen(false);
    } catch {
      setReportError("Could not submit report. Please try again.");
    } finally {
      setIsSubmittingReport(false);
    }
  }

  if (isLoading && passages.length === 0) {
    return (
      <div className="min-h-full w-full px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-72 animate-pulse rounded-lg bg-card" />
          <div className="h-40 animate-pulse rounded-lg bg-card" />
        </div>
      </div>
    );
  }

  if (error || passages.length === 0) {
    return (
      <div className="min-h-full w-full px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          {error ?? "Passage not found."}
        </div>
      </div>
    );
  }

  if (!isMobile && activePassage) {
    const highlightedSentenceMap = buildHighlightedSentenceMap(activePassage);
    const answerByQuestionId = answerMapByQuestionId(activePassage.answer_key);
    const displayQuestions = getDisplayQuestions(activePassage);

    return (
      <div
        className="tablet-portrait-main relative h-[calc(100dvh-60px)] w-full overflow-hidden px-3 pb-3 pt-3"
        onWheel={handleDesktopHorizontalScroll}
      >
        <div className="absolute left-0 right-0 top-0 z-20 h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, ((currentIndex + 1) / Math.max(passages.length, 1)) * 100))}%`,
            }}
          />
        </div>
        <div className="mx-auto mb-3 flex w-full max-w-[1600px] items-center justify-between gap-3">
          {rankPlate ? <RankPlate plate={rankPlate} className="h-9 min-w-0" /> : <div />}
          <AudioButton speaking={isSpeaking} onClick={() => toggleSpeech(activePassage)} />
        </div>

        <div className="desktop-reading-grid mx-auto grid h-[calc(100%-60px)] w-full max-w-[1600px] grid-cols-[1.22fr_1fr] gap-3">
          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card px-4 pb-4 pt-2">
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <PassageHeader passage={activePassage} />
              <PassageText
                sentences={activePassage.passage_sentences}
                highlightedSentenceMap={highlightedSentenceMap}
                vocabItems={activePassage.vocab ?? []}
                onVocabTap={setSelectedVocab}
              />
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <PassageTagRow
                passage={activePassage}
                dailyAttempted={todayStats.attempted}
                answeredCount={getAnsweredCountForPassage(activePassage.id)}
              />
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-lg border border-border bg-background px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2">
              {displayQuestions.map((question, index) => {
                const answer = getAnswerForQuestion(activePassage.id, question.id);
                const revealed = isQuestionRevealed(activePassage.id, question.id);

                return (
                  <QuestionBlock
                    key={question.id}
                    question={question}
                    displayIndex={index + 1}
                    answer={answer}
                    answerKey={answerByQuestionId.get(question.id)}
                    revealed={revealed}
                    rankFeedback={
                      rankFeedbackByQuestion[
                        toRankFeedbackKey(activePassage.id, question.id)
                      ]
                    }
                    onAnswerChange={(nextAnswer) =>
                      handleAnswerChange(activePassage.id, question.id, nextAnswer)
                    }
                    onSubmitAnswer={(nextAnswer) =>
                      revealAnswer(activePassage.id, question, nextAnswer ?? answer)
                    }
                  />
                );
              })}
            </div>
          </section>
        </div>

        <FloatingActionButtons
          saved={isSaved}
          reportDisabled={isReportDisabled}
          onSaveToggle={() => toggleSaveCard(activePassage.id)}
          onReportClick={openReportDialog}
        />

        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center pl-2">
          <button
            type="button"
            onClick={handlePreviousArrowTap}
            disabled={!hasPrevPassage || isArrowTapCooldown}
            className={`desktop-arrow-btn pointer-events-auto flex h-24 w-14 items-center justify-center rounded-lg border transition-colors ${
              hasPrevPassage && !isArrowTapCooldown
                ? "border-border bg-card/85 text-foreground hover:border-primary"
                : "cursor-not-allowed border-border bg-card/45 text-muted-foreground"
            }`}
            aria-label="Previous passage"
          >
            <ChevronLeft className="desktop-arrow-icon h-10 w-10" />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center pr-2">
          <button
            type="button"
            onClick={handleNextArrowTap}
            disabled={isArrowTapCooldown}
            className={`desktop-arrow-btn pointer-events-auto flex h-24 w-14 items-center justify-center rounded-lg border transition-colors ${
              isArrowTapCooldown
                ? "cursor-not-allowed border-border bg-card/45 text-muted-foreground"
                : "border-border bg-card/85 text-foreground hover:border-primary"
            }`}
            aria-label="Next passage"
          >
            <ChevronRight className="desktop-arrow-icon h-10 w-10" />
          </button>
        </div>

        <VocabMeaningDialog
          selectedVocab={selectedVocab}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedVocab(null);
            }
          }}
        />

        <PassageReportDialog
          open={isReportDialogOpen}
          reportType={selectedReportType}
          isSubmitting={isSubmittingReport}
          error={reportError}
          onOpenChange={setIsReportDialogOpen}
          onReportTypeChange={setSelectedReportType}
          onSubmit={() => {
            void handleSubmitPassageReport();
          }}
        />
        {recentAchievementUnlocks[0] && (
          <AchievementUnlockedToast achievement={recentAchievementUnlocks[0]} />
        )}
      </div>
    );
  }

  return (
    <div className="tablet-portrait-main relative h-[calc(100dvh-60px)] w-full overflow-hidden">
      <div className="absolute left-0 right-0 top-0 z-20 h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${Math.max(0, Math.min(100, ((currentIndex + 1) / Math.max(passages.length, 1)) * 100))}%`,
          }}
        />
      </div>
      <div
        className="h-full w-full overflow-hidden"
        onTouchStart={handleMobileSwipeStart}
        onTouchEnd={handleMobileSwipeEnd}
      >
        <div
          className="flex h-full w-full touch-pan-y transition-transform duration-200 ease-out"
          style={{ transform: `translate3d(-${currentIndex * 100}%, 0, 0)` }}
        >
          {passages.map((passage, index) => {
            const inRenderWindow = Math.abs(index - currentIndex) <= WINDOW_RADIUS;

            return (
              <section
                key={passage.id}
                data-passage-id={passage.id}
                className="h-full w-full flex-none overflow-hidden px-3 pb-3 pt-3"
              >
                {inRenderWindow ? (
                  (() => {
                    const answerByQuestionId = answerMapByQuestionId(passage.answer_key);
                    const highlightedSentenceMap = buildHighlightedSentenceMap(passage);
                    const displayQuestions = getDisplayQuestions(passage);

                    return (
                      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
                        <div className="flex items-center justify-between gap-3">
                          {rankPlate ? (
                            <RankPlate plate={rankPlate} className="h-9 min-w-0" />
                          ) : (
                            <div />
                          )}
                          <AudioButton
                            speaking={isSpeaking}
                            onClick={() => toggleSpeech(passage)}
                          />
                        </div>

                        <div className="mt-2 grid min-h-0 flex-1 grid-rows-2 gap-2">
                          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card px-4 pb-4 pt-2">
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              <PassageHeader passage={passage} />
                              <PassageText
                                sentences={passage.passage_sentences}
                                highlightedSentenceMap={highlightedSentenceMap}
                                vocabItems={passage.vocab ?? []}
                                onVocabTap={setSelectedVocab}
                              />
                            </div>
                            <div className="mt-3 border-t border-border pt-3">
                              <PassageTagRow
                                passage={passage}
                                dailyAttempted={todayStats.attempted}
                                answeredCount={getAnsweredCountForPassage(passage.id)}
                              />
                            </div>
                          </section>

                          <section className="min-h-0 overflow-y-auto overscroll-y-contain rounded-lg border border-border bg-background px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="space-y-2">
                              {displayQuestions.map((question, questionIndex) => {
                                const answer = getAnswerForQuestion(passage.id, question.id);
                                const revealed = isQuestionRevealed(passage.id, question.id);

                                return (
                                  <QuestionBlock
                                    key={question.id}
                                    question={question}
                                    displayIndex={questionIndex + 1}
                                    answer={answer}
                                    answerKey={answerByQuestionId.get(question.id)}
                                    revealed={revealed}
                                    rankFeedback={
                                      rankFeedbackByQuestion[
                                        toRankFeedbackKey(passage.id, question.id)
                                      ]
                                    }
                                    onAnswerChange={(nextAnswer) =>
                                      handleAnswerChange(passage.id, question.id, nextAnswer)
                                    }
                                    onSubmitAnswer={(nextAnswer) =>
                                      revealAnswer(passage.id, question, nextAnswer ?? answer)
                                    }
                                  />
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
                    <div className="rounded-lg border border-border bg-card px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/85">
                        Loading Card
                      </p>
                      <h2 className="mt-2 text-xl font-semibold leading-tight text-foreground">
                        {passage.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{passage.topic_label}</p>
                      <p className="mt-4 text-xs text-muted-foreground">
                        Swipe to load full passage content.
                      </p>
                    </div>
                    <div className="mt-2 min-h-0 flex-1 rounded-lg border border-border bg-card" />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center pl-1">
        <div
          className={`flex h-24 w-8 items-center justify-center rounded-lg border border-border bg-card/75 text-muted-foreground backdrop-blur transition-opacity ${
            currentIndex > 0 ? "opacity-100" : "opacity-0"
          }`}
        >
          <ChevronLeft className="h-6 w-6" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center pr-1">
        <div
          className={`flex h-24 w-8 items-center justify-center rounded-lg border border-border bg-card/75 text-muted-foreground backdrop-blur transition-opacity ${
            currentIndex < passages.length - 1 ? "animate-pulse opacity-100" : "opacity-0"
          }`}
        >
          <ChevronRight className="h-6 w-6" />
        </div>
      </div>

      {isAppending && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-border bg-card/85 px-3 py-1 text-xs text-muted-foreground">
          Loading more sets...
        </div>
      )}

      {activePassage && (
        <FloatingActionButtons
          saved={isCardSaved(activePassage.id)}
          reportDisabled={isReportDisabled}
          onSaveToggle={() => toggleSaveCard(activePassage.id)}
          onReportClick={openReportDialog}
        />
      )}

      <VocabMeaningDialog
        selectedVocab={selectedVocab}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVocab(null);
          }
        }}
      />

      <PassageReportDialog
        open={isReportDialogOpen}
        reportType={selectedReportType}
        isSubmitting={isSubmittingReport}
        error={reportError}
        onOpenChange={setIsReportDialogOpen}
        onReportTypeChange={setSelectedReportType}
        onSubmit={() => {
          void handleSubmitPassageReport();
        }}
      />
      {recentAchievementUnlocks[0] && (
        <AchievementUnlockedToast achievement={recentAchievementUnlocks[0]} />
      )}
    </div>
  );
}
