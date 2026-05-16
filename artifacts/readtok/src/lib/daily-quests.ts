import type { AnswerStatsPeriod, AnswerStatQuestionType } from "@/lib/profile-api";

export const DAILY_MAIN_QUEST_TARGET = 10;
export const DAILY_QUEST_PROGRESS_POINTS_PER_QUEST = 5;
export const DAILY_QUEST_PROGRESS_MILESTONES = [20, 40, 60, 80, 100, 150, 200] as const;

export const DAILY_QUEST_MILESTONE_BONUS_XP: Record<number, number> = {
  20: 15,
  40: 30,
  60: 50,
  80: 70,
  100: 95,
  150: 150,
  200: 220,
};

type QuestSlot = "main" | "focus" | "style";
type QuestProgressMetric = "attempted" | "correct" | "accuracy";

export interface DailyQuestItem {
  id: string;
  slot: QuestSlot;
  title: string;
  requirement: string;
  hint: string;
  progressLabel: string;
  progressPercent: number;
  isComplete: boolean;
}

export interface DailyQuestBoard {
  localDateKey: string;
  quests: DailyQuestItem[];
  completeCount: number;
}

interface DailyQuestBuildInput {
  localDateKey: string;
  attemptedToday: number;
  correctToday: number;
  todayPeriod: AnswerStatsPeriod | null;
}

interface QuestTemplate {
  id: string;
  title: string;
  requirement: string;
  hint: string;
  progressMetric: QuestProgressMetric;
  targetValue: number;
  minAttemptsForAccuracy?: number;
  questionType?: AnswerStatQuestionType;
  bandGroup?: "Band6" | "Band7" | "Band75" | "Band8Plus";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashDay(localDateKey: string) {
  let hash = 0;
  for (let index = 0; index < localDateKey.length; index += 1) {
    hash = (hash * 31 + localDateKey.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickRotatingTemplates<T>(
  templates: T[],
  seed: number,
  count: number,
): T[] {
  if (templates.length === 0 || count <= 0) return [];
  const picked: T[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const index = (seed + offset) % templates.length;
    picked.push(templates[index]);
  }
  return picked;
}

function sumTypeAttempts(period: AnswerStatsPeriod | null, questionType: AnswerStatQuestionType) {
  if (!period) return 0;
  let total = 0;
  for (const byType of Object.values(period.byBandAndType ?? {})) {
    if (!byType) continue;
    total += byType[questionType]?.total ?? 0;
  }
  return total;
}

function sumBandAttempts(period: AnswerStatsPeriod | null, bandGroup: "Band6" | "Band7" | "Band75" | "Band8Plus") {
  if (!period) return 0;
  let total = 0;
  const byType = period.byBandAndType?.[bandGroup];
  if (!byType) return 0;
  for (const cell of Object.values(byType)) {
    total += cell?.total ?? 0;
  }
  return total;
}

function countDistinctTypes(period: AnswerStatsPeriod | null) {
  if (!period) return 0;
  const found = new Set<AnswerStatQuestionType>();
  for (const byType of Object.values(period.byBandAndType ?? {})) {
    if (!byType) continue;
    for (const [questionType, cell] of Object.entries(byType)) {
      if ((cell?.total ?? 0) > 0) {
        found.add(questionType as AnswerStatQuestionType);
      }
    }
  }
  return found.size;
}

function buildProgressLabel(metric: QuestProgressMetric, progress: number, target: number) {
  if (metric === "accuracy") {
    return `${clampPercent(progress)}% / ${target}%`;
  }
  return `${Math.max(0, Math.trunc(progress))} / ${target}`;
}

function buildQuestItem({
  slot,
  template,
  attemptedToday,
  correctToday,
  todayPeriod,
  distinctTypeCount,
}: {
  slot: QuestSlot;
  template: QuestTemplate;
  attemptedToday: number;
  correctToday: number;
  todayPeriod: AnswerStatsPeriod | null;
  distinctTypeCount: number;
}): DailyQuestItem {
  let progressValue = 0;
  let completionPercent = 0;

  if (template.id === "variety_sampler") {
    progressValue = distinctTypeCount;
    completionPercent = clampPercent((progressValue / template.targetValue) * 100);
  } else if (template.progressMetric === "attempted") {
    if (template.questionType) {
      progressValue = sumTypeAttempts(todayPeriod, template.questionType);
    } else if (template.bandGroup) {
      progressValue = sumBandAttempts(todayPeriod, template.bandGroup);
    } else {
      progressValue = attemptedToday;
    }
    completionPercent = clampPercent((progressValue / template.targetValue) * 100);
  } else if (template.progressMetric === "correct") {
    progressValue = correctToday;
    completionPercent = clampPercent((progressValue / template.targetValue) * 100);
  } else {
    progressValue = attemptedToday > 0 ? (correctToday / attemptedToday) * 100 : 0;
    const hasMinAttempts =
      template.minAttemptsForAccuracy === undefined ||
      attemptedToday >= template.minAttemptsForAccuracy;
    completionPercent = hasMinAttempts
      ? clampPercent((progressValue / template.targetValue) * 100)
      : 0;
  }

  const isComplete =
    template.progressMetric === "accuracy"
      ? completionPercent >= 100 &&
        (template.minAttemptsForAccuracy === undefined ||
          attemptedToday >= template.minAttemptsForAccuracy)
      : progressValue >= template.targetValue;

  return {
    id: template.id,
    slot,
    title: template.title,
    requirement: template.requirement,
    hint: template.hint,
    progressLabel: buildProgressLabel(
      template.progressMetric,
      template.progressMetric === "accuracy" ? progressValue : progressValue,
      template.targetValue,
    ),
    progressPercent: completionPercent,
    isComplete,
  };
}

const focusTemplates: QuestTemplate[] = [
  {
    id: "truth_hunter",
    title: "Truth Hunter",
    requirement: "Answer 4 TFNG questions",
    hint: "Read claims carefully before choosing TRUE/FALSE/NG.",
    progressMetric: "attempted",
    questionType: "TFNG",
    targetValue: 4,
  },
  {
    id: "choice_breaker",
    title: "Choice Breaker",
    requirement: "Answer 4 MCQ questions",
    hint: "Eliminate distractors before you lock in.",
    progressMetric: "attempted",
    questionType: "MCQ",
    targetValue: 4,
  },
  {
    id: "blank_sniper",
    title: "Blank Sniper",
    requirement: "Answer 3 Sentence Completion questions",
    hint: "Keep answers concise and exact.",
    progressMetric: "attempted",
    questionType: "SentenceCompletion",
    targetValue: 3,
  },
  {
    id: "matchmaker_run",
    title: "Matchmaker Run",
    requirement: "Answer 3 Matching questions",
    hint: "Scan key nouns and anchors first.",
    progressMetric: "attempted",
    questionType: "Matching",
    targetValue: 3,
  },
  {
    id: "band8_boss_tap",
    title: "Band 8 Boss Tap",
    requirement: "Answer 2 Band 8.0+ questions",
    hint: "Take your time and read every qualifier.",
    progressMetric: "attempted",
    bandGroup: "Band8Plus",
    targetValue: 2,
  },
];

const styleTemplates: QuestTemplate[] = [
  {
    id: "clean_cut",
    title: "Clean Cut",
    requirement: "Get 6 correct answers today",
    hint: "Consistency over speed.",
    progressMetric: "correct",
    targetValue: 6,
  },
  {
    id: "sharp_session",
    title: "Sharp Session",
    requirement: "Reach 70% accuracy over 10+ answers",
    hint: "Play steady and reduce forced guesses.",
    progressMetric: "accuracy",
    targetValue: 70,
    minAttemptsForAccuracy: 10,
  },
  {
    id: "variety_sampler",
    title: "Mode Sampler",
    requirement: "Use 3 different question types today",
    hint: "Touch multiple formats in one session.",
    progressMetric: "attempted",
    targetValue: 3,
  },
  {
    id: "hard_mode_sampler",
    title: "Hard Mode Sampler",
    requirement: "Answer 3 Band 7.5+ questions",
    hint: "Push into tougher cards today.",
    progressMetric: "attempted",
    bandGroup: "Band75",
    targetValue: 3,
  },
];

export function buildDailyQuestBoard({
  localDateKey,
  attemptedToday,
  correctToday,
  todayPeriod,
}: DailyQuestBuildInput): DailyQuestBoard {
  const safeAttempted = Math.max(0, Math.trunc(attemptedToday));
  const safeCorrect = Math.max(0, Math.trunc(correctToday));
  const daySeed = hashDay(localDateKey);
  const distinctTypeCount = countDistinctTypes(todayPeriod);

  const mainQuest: QuestTemplate = {
    id: "first_raid",
    title: "First Raid",
    requirement: "Answer 10 questions",
    hint: "Warm up and build momentum.",
    progressMetric: "attempted",
    targetValue: DAILY_MAIN_QUEST_TARGET,
  };
  const focusQuests = pickRotatingTemplates(
    focusTemplates,
    daySeed % focusTemplates.length,
    3,
  );
  const styleQuests = pickRotatingTemplates(
    styleTemplates,
    (daySeed + 3) % styleTemplates.length,
    2,
  );

  const orderedTemplates: Array<{ slot: QuestSlot; template: QuestTemplate }> = [
    { slot: "main", template: mainQuest },
    ...focusQuests.map((template) => ({ slot: "focus" as const, template })),
    ...styleQuests.map((template) => ({ slot: "style" as const, template })),
  ];

  const quests = orderedTemplates.map(({ slot, template }) =>
    buildQuestItem({
      slot,
      template,
      attemptedToday: safeAttempted,
      correctToday: safeCorrect,
      todayPeriod,
      distinctTypeCount,
    }),
  );

  return {
    localDateKey,
    quests,
    completeCount: quests.filter((quest) => quest.isComplete).length,
  };
}
