export type AchievementPhase = "v1" | "v2";

export type AchievementCategory =
  | "core_progress"
  | "correct_answers"
  | "streak"
  | "daily_goal"
  | "practice_streak"
  | "accuracy"
  | "question_type_mastery"
  | "question_type_accuracy"
  | "band_level"
  | "ranked"
  | "lp_momentum"
  | "comeback"
  | "collection"
  | "quality"
  | "exploration"
  | "time_based";

export type AchievementTrigger =
  | "ANSWER_SUBMITTED"
  | "DAILY_GOAL_COMPLETED"
  | "RANK_UPDATED"
  | "LP_GAINED"
  | "PASSAGE_SAVED"
  | "REPORT_SUBMITTED";

export const QUESTION_TYPES = [
  "MCQ",
  "TFNG",
  "SentenceCompletion",
  "ShortAnswer",
  "Matching",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const BAND_GROUPS = ["Band6", "Band7", "Band75", "Band8Plus"] as const;

export type BandGroup = (typeof BAND_GROUPS)[number];

export const RANKS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const;

export type Rank = (typeof RANKS)[number];

export type RollingWindowKey = "last20" | "last50" | "last100";

export type AchievementCondition =
  | {
      type: "counter";
      field: keyof UserAchievementProgress;
      target: number;
    }
  | {
      type: "nested_counter";
      field: "questionTypeAttempts" | "questionTypeCorrect" | "bandAttempts" | "bandCorrect";
      key: QuestionType | BandGroup;
      target: number;
    }
  | {
      type: "accuracy";
      attemptsField: keyof UserAchievementProgress;
      correctField: keyof UserAchievementProgress;
      minAttempts: number;
      accuracy: number;
    }
  | {
      type: "nested_accuracy";
      attemptsField: "questionTypeAttempts";
      correctField: "questionTypeCorrect";
      key: QuestionType;
      minAttempts: number;
      accuracy: number;
    }
  | {
      type: "rank_reached";
      rank: Rank;
    }
  | {
      type: "all_nested_counters_at_least";
      field: "questionTypeAttempts" | "bandAttempts";
      target: number;
    }
  | {
      type: "comeback";
      requiredWrongStreak: number;
      requiredCorrectStreak: number;
    }
  | {
      type: "rolling_accuracy";
      window: RollingWindowKey;
      minAttempts: number;
      accuracy: number;
    };

export interface AchievementDefinition {
  key: string;
  family: string;
  tier: string;
  title: string;
  description: string;
  category: AchievementCategory;
  trigger: AchievementTrigger;
  condition: AchievementCondition;
  icon: string;
  phase: AchievementPhase;
  achievementXp: number;
}

export interface UserAchievementProgress {
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  lifetimeAccuracy: number;
  currentCorrectStreak: number;
  bestCorrectStreak: number;
  currentWrongStreak: number;
  previousAnswerWasWrong: boolean;
  lastWrongStreakBeforeRecovery: number;
  currentRecoveryCorrectStreak: number;
  damageControlCount: number;
  dailyGoalHits: number;
  dailyAnsweredCount: number;
  lastDailyAnswerDateLocal: string | null;
  lastDailyGoalDateLocal: string | null;
  currentPracticeStreakDays: number;
  bestPracticeStreakDays: number;
  lastPracticeDateLocal: string | null;
  questionTypeAttempts: Record<QuestionType, number>;
  questionTypeCorrect: Record<QuestionType, number>;
  bandAttempts: Record<BandGroup, number>;
  bandCorrect: Record<BandGroup, number>;
  currentRank: Rank;
  currentLP: number;
  dailyLPGained: number;
  bestSingleDayLPGain: number;
  lastLPDateLocal: string | null;
  savedPassageCount: number;
  reportCount: number;
  answeredQuestionTypes: Record<QuestionType, boolean>;
  answeredBandGroups: Record<BandGroup, boolean>;
  rollingWindows: Record<RollingWindowKey, string>;
  earlyBirdDays: number;
  nightOwlDays: number;
  weekendPracticeDays: number;
  earlyBirdDateKeys: string[];
  nightOwlDateKeys: string[];
  weekendPracticeDateKeys: string[];
  unlockedAchievementKeys: string[];
}

export interface AnswerAchievementContext {
  questionType?: string;
  band?: string | number;
  dailyGoalTarget: number;
  now?: Date;
}

export interface RankedAchievementContext {
  rank?: string;
  rankedPointsAfter?: number;
  lpDelta?: number;
  now?: Date;
}

export interface AchievementLevelProgress {
  totalXp: number;
  currentLevel: number;
  currentLevelXpFloor: number;
  nextLevelXpFloor: number | null;
  xpIntoLevel: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
}

export const RANK_ORDER: Record<Rank, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Master: 6,
  Grandmaster: 7,
  Challenger: 8,
};

const ACHIEVEMENT_LEVEL_THRESHOLDS = [
  0, 120, 280, 480, 740, 1060, 1440, 1880, 2380, 2940, 3560, 4240,
] as const;

const zeroQuestionTypeRecord = (): Record<QuestionType, number> => ({
  MCQ: 0,
  TFNG: 0,
  SentenceCompletion: 0,
  ShortAnswer: 0,
  Matching: 0,
});

const zeroBandRecord = (): Record<BandGroup, number> => ({
  Band6: 0,
  Band7: 0,
  Band75: 0,
  Band8Plus: 0,
});

const falseQuestionTypeRecord = (): Record<QuestionType, boolean> => ({
  MCQ: false,
  TFNG: false,
  SentenceCompletion: false,
  ShortAnswer: false,
  Matching: false,
});

const falseBandRecord = (): Record<BandGroup, boolean> => ({
  Band6: false,
  Band7: false,
  Band75: false,
  Band8Plus: false,
});

export const defaultAchievementProgress: UserAchievementProgress = {
  totalQuestionsAnswered: 0,
  totalCorrectAnswers: 0,
  totalWrongAnswers: 0,
  lifetimeAccuracy: 0,
  currentCorrectStreak: 0,
  bestCorrectStreak: 0,
  currentWrongStreak: 0,
  previousAnswerWasWrong: false,
  lastWrongStreakBeforeRecovery: 0,
  currentRecoveryCorrectStreak: 0,
  damageControlCount: 0,
  dailyGoalHits: 0,
  dailyAnsweredCount: 0,
  lastDailyAnswerDateLocal: null,
  lastDailyGoalDateLocal: null,
  currentPracticeStreakDays: 0,
  bestPracticeStreakDays: 0,
  lastPracticeDateLocal: null,
  questionTypeAttempts: zeroQuestionTypeRecord(),
  questionTypeCorrect: zeroQuestionTypeRecord(),
  bandAttempts: zeroBandRecord(),
  bandCorrect: zeroBandRecord(),
  currentRank: "Bronze",
  currentLP: 0,
  dailyLPGained: 0,
  bestSingleDayLPGain: 0,
  lastLPDateLocal: null,
  savedPassageCount: 0,
  reportCount: 0,
  answeredQuestionTypes: falseQuestionTypeRecord(),
  answeredBandGroups: falseBandRecord(),
  rollingWindows: {
    last20: "",
    last50: "",
    last100: "",
  },
  earlyBirdDays: 0,
  nightOwlDays: 0,
  weekendPracticeDays: 0,
  earlyBirdDateKeys: [],
  nightOwlDateKeys: [],
  weekendPracticeDateKeys: [],
  unlockedAchievementKeys: [],
};

function numberOrZero(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
}

function booleanOrFalse(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sanitizeNumberRecord<T extends string>(
  keys: readonly T[],
  value: unknown,
): Record<T, number> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return keys.reduce(
    (record, key) => ({
      ...record,
      [key]: numberOrZero(source[key]),
    }),
    {} as Record<T, number>,
  );
}

function sanitizeBooleanRecord<T extends string>(
  keys: readonly T[],
  value: unknown,
): Record<T, boolean> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return keys.reduce(
    (record, key) => ({
      ...record,
      [key]: booleanOrFalse(source[key]),
    }),
    {} as Record<T, boolean>,
  );
}

function sanitizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sanitizeRank(value: unknown): Rank {
  return RANKS.includes(value as Rank) ? (value as Rank) : "Bronze";
}

function normalizeString(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeQuestionType(type: string): QuestionType | null {
  const normalized = normalizeString(type);
  if (normalized === "mcq" || normalized === "multiple_choice") return "MCQ";
  if (normalized === "tfng" || normalized === "true_false_not_given") return "TFNG";
  if (normalized === "sentencecompletion" || normalized === "sentence_completion") {
    return "SentenceCompletion";
  }
  if (normalized === "shortanswer" || normalized === "short_answer") return "ShortAnswer";
  if (
    normalized === "matching" ||
    normalized === "matchingheading" ||
    normalized === "matching_heading" ||
    normalized === "matchinginformation" ||
    normalized === "matching_information"
  ) {
    return "Matching";
  }
  return null;
}

export function normalizeBandGroup(band: string | number): BandGroup | null {
  const normalized = String(band).trim().toLowerCase().replace(/^band\s*/, "");
  if (band === 6 || normalized === "6" || normalized === "6.0") return "Band6";
  if (band === 7 || normalized === "7" || normalized === "7.0") return "Band7";
  if (band === 7.5 || normalized === "7.5") return "Band75";
  if (band === 8 || normalized === "8" || normalized === "8.0" || normalized === "8.0+") {
    return "Band8Plus";
  }
  return null;
}

export function formatAchievementDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayDifference(previousDayKey: string, currentDayKey: string) {
  const previousDate = new Date(`${previousDayKey}T00:00:00`);
  const currentDate = new Date(`${currentDayKey}T00:00:00`);
  return Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000);
}

function updateRollingWindow(currentValue: string, isCorrect: boolean, maxLength: number) {
  const compact = `${currentValue}${isCorrect ? "R" : "W"}`.replace(/[^RW]/g, "");
  return compact.slice(Math.max(0, compact.length - maxLength));
}

function rollingAccuracy(value: string) {
  const attempts = value.length;
  if (attempts === 0) {
    return 0;
  }
  const correct = [...value].filter((item) => item === "R").length;
  return correct / attempts;
}

export function sanitizeAchievementProgress(
  value: unknown,
  legacy?: {
    totalQuestionsAnswered?: number;
    totalCorrectAnswers?: number;
    totalWrongAnswers?: number;
    currentPracticeStreakDays?: number;
    lastPracticeDateLocal?: string | null;
    savedPassageCount?: number;
  },
): UserAchievementProgress {
  const source =
    value && typeof value === "object" ? (value as Partial<UserAchievementProgress>) : {};
  const totalQuestionsAnswered =
    numberOrZero(source.totalQuestionsAnswered) ||
    numberOrZero(legacy?.totalQuestionsAnswered);
  const totalCorrectAnswers =
    numberOrZero(source.totalCorrectAnswers) || numberOrZero(legacy?.totalCorrectAnswers);
  const totalWrongAnswers =
    numberOrZero(source.totalWrongAnswers) ||
    numberOrZero(legacy?.totalWrongAnswers) ||
    Math.max(0, totalQuestionsAnswered - totalCorrectAnswers);
  const lifetimeAccuracy =
    totalQuestionsAnswered > 0 ? totalCorrectAnswers / totalQuestionsAnswered : 0;
  const rollingSource: Record<string, unknown> =
    source.rollingWindows && typeof source.rollingWindows === "object"
      ? source.rollingWindows
      : {};

  return {
    ...defaultAchievementProgress,
    totalQuestionsAnswered,
    totalCorrectAnswers,
    totalWrongAnswers,
    lifetimeAccuracy,
    currentCorrectStreak: numberOrZero(source.currentCorrectStreak),
    bestCorrectStreak: numberOrZero(source.bestCorrectStreak),
    currentWrongStreak: numberOrZero(source.currentWrongStreak),
    previousAnswerWasWrong: booleanOrFalse(source.previousAnswerWasWrong),
    lastWrongStreakBeforeRecovery: numberOrZero(source.lastWrongStreakBeforeRecovery),
    currentRecoveryCorrectStreak: numberOrZero(source.currentRecoveryCorrectStreak),
    damageControlCount: numberOrZero(source.damageControlCount),
    dailyGoalHits: numberOrZero(source.dailyGoalHits),
    dailyAnsweredCount: numberOrZero(source.dailyAnsweredCount),
    lastDailyAnswerDateLocal: stringOrNull(source.lastDailyAnswerDateLocal),
    lastDailyGoalDateLocal: stringOrNull(source.lastDailyGoalDateLocal),
    currentPracticeStreakDays:
      numberOrZero(source.currentPracticeStreakDays) ||
      numberOrZero(legacy?.currentPracticeStreakDays),
    bestPracticeStreakDays:
      numberOrZero(source.bestPracticeStreakDays) ||
      numberOrZero(legacy?.currentPracticeStreakDays),
    lastPracticeDateLocal:
      stringOrNull(source.lastPracticeDateLocal) ??
      stringOrNull(legacy?.lastPracticeDateLocal),
    questionTypeAttempts: sanitizeNumberRecord(QUESTION_TYPES, source.questionTypeAttempts),
    questionTypeCorrect: sanitizeNumberRecord(QUESTION_TYPES, source.questionTypeCorrect),
    bandAttempts: sanitizeNumberRecord(BAND_GROUPS, source.bandAttempts),
    bandCorrect: sanitizeNumberRecord(BAND_GROUPS, source.bandCorrect),
    currentRank: sanitizeRank(source.currentRank),
    currentLP: numberOrZero(source.currentLP),
    dailyLPGained: numberOrZero(source.dailyLPGained),
    bestSingleDayLPGain: numberOrZero(source.bestSingleDayLPGain),
    lastLPDateLocal: stringOrNull(source.lastLPDateLocal),
    savedPassageCount:
      numberOrZero(source.savedPassageCount) || numberOrZero(legacy?.savedPassageCount),
    reportCount: numberOrZero(source.reportCount),
    answeredQuestionTypes: sanitizeBooleanRecord(
      QUESTION_TYPES,
      source.answeredQuestionTypes,
    ),
    answeredBandGroups: sanitizeBooleanRecord(BAND_GROUPS, source.answeredBandGroups),
    rollingWindows: {
      last20:
        typeof rollingSource.last20 === "string"
          ? rollingSource.last20.replace(/[^RW]/g, "").slice(-20)
          : "",
      last50:
        typeof rollingSource.last50 === "string"
          ? rollingSource.last50.replace(/[^RW]/g, "").slice(-50)
          : "",
      last100:
        typeof rollingSource.last100 === "string"
          ? rollingSource.last100.replace(/[^RW]/g, "").slice(-100)
          : "",
    },
    earlyBirdDays: numberOrZero(source.earlyBirdDays),
    nightOwlDays: numberOrZero(source.nightOwlDays),
    weekendPracticeDays: numberOrZero(source.weekendPracticeDays),
    earlyBirdDateKeys: sanitizeStringArray(source.earlyBirdDateKeys),
    nightOwlDateKeys: sanitizeStringArray(source.nightOwlDateKeys),
    weekendPracticeDateKeys: sanitizeStringArray(source.weekendPracticeDateKeys),
    unlockedAchievementKeys: sanitizeStringArray(source.unlockedAchievementKeys),
  };
}

const coreProgress = [
  ["first_quest_tutorial_cleared", "Tutorial Cleared", "First Quest: Tutorial Cleared", 1],
  ["quest_grinder_rookie", "Rookie", "Quest Grinder Rookie", 25],
  ["quest_grinder_runner", "Runner", "Quest Grinder Runner", 100],
  ["quest_grinder_veteran", "Veteran", "Quest Grinder Veteran", 500],
  ["quest_grinder_machine", "Machine", "Quest Grinder Machine", 1000],
  ["quest_grinder_legend", "Legend", "Quest Grinder Legend", 5000],
] as const;

const correctAnswers = [
  ["answer_slayer_first_blood", "First Blood", "Answer Slayer First Blood", 10],
  ["answer_slayer_clean_hit", "Clean Hit", "Answer Slayer Clean Hit", 50],
  ["answer_slayer_locked_on", "Locked On", "Answer Slayer Locked On", 250],
  ["answer_slayer_scholar_mode", "Scholar Mode", "Answer Slayer Scholar Mode", 1000],
  ["answer_slayer_overlord", "Overlord", "Answer Slayer Overlord", 5000],
] as const;

const correctStreaks = [
  ["combo_chain_spark", "Spark", "Combo Chain Spark", 3],
  ["combo_chain_adept", "Adept", "Combo Chain Adept", 5],
  ["combo_chain_specialist", "Specialist", "Combo Chain Specialist", 10],
  ["combo_chain_master", "Master", "Combo Chain Master", 25],
  ["combo_chain_mythic", "Mythic", "Combo Chain Mythic", 50],
] as const;

const dailyGoals = [
  ["daily_quest_accepted", "Accepted", "Daily Quest Accepted", 1],
  ["daily_quest_streaker", "Streaker", "Daily Quest Streaker", 3],
  ["daily_quest_grinder", "Grinder", "Daily Quest Grinder", 10],
  ["daily_quest_clockwork", "Clockwork", "Daily Quest Clockwork", 30],
  ["daily_quest_legend", "Legend", "Daily Quest Legend", 100],
] as const;

const practiceStreaks = [
  ["login_streak_spark", "Spark", "Login Streak Spark", 2],
  ["login_streak_threepeat", "Threepeat", "Login Streak Threepeat", 3],
  ["login_streak_week_warrior", "Week Warrior", "Login Streak Week Warrior", 7],
  ["login_streak_fortnight_flame", "Fortnight Flame", "Login Streak Fortnight Flame", 14],
  ["login_streak_iron_discipline", "Iron Discipline", "Login Streak Iron Discipline", 30],
] as const;

const savedPassages = [
  ["knowledge_vault_first_save", "First Save", "Knowledge Vault First Save", 1],
  ["knowledge_vault_reading_stash", "Reading Stash", "Knowledge Vault Reading Stash", 10],
  ["knowledge_vault_archive_builder", "Archive Builder", "Knowledge Vault Archive Builder", 50],
  ["knowledge_vault_private_library", "Private Library", "Knowledge Vault Private Library", 100],
] as const;

const rankedClimber: Array<[string, string, string, Rank]> = [
  ["ranked_climber_bronze_spawn", "Bronze Spawn", "Ranked Climber Bronze Spawn", "Bronze"],
  ["ranked_climber_silver_striker", "Silver Striker", "Ranked Climber Silver Striker", "Silver"],
  ["ranked_climber_gold_core", "Gold Core", "Ranked Climber Gold Core", "Gold"],
  [
    "ranked_climber_platinum_mentality",
    "Platinum Mentality",
    "Ranked Climber Platinum Mentality",
    "Platinum",
  ],
  ["ranked_climber_diamond_brain", "Diamond Brain", "Ranked Climber Diamond Brain", "Diamond"],
  ["ranked_climber_mastermind", "Mastermind", "Ranked Climber Mastermind", "Master"],
  [
    "ranked_climber_grandmaster_reader",
    "Grandmaster Reader",
    "Ranked Climber Grandmaster Reader",
    "Grandmaster",
  ],
  [
    "ranked_climber_challenger_mind",
    "Challenger Mind",
    "Ranked Climber Challenger Mind",
    "Challenger",
  ],
];

const typeMastery: Array<[QuestionType, string, string, string, Array<[string, string, number]>]> = [
  [
    "MCQ",
    "MCQ Main",
    "target",
    "MCQ",
    [
      ["mcq_main_initiate", "Initiate", 20],
      ["mcq_main_adept", "Adept", 100],
      ["mcq_main_elite", "Elite", 300],
      ["mcq_main_master", "Master", 1000],
    ],
  ],
  [
    "TFNG",
    "Truth Judge",
    "scale",
    "TFNG",
    [
      ["truth_judge_initiate", "Initiate", 20],
      ["truth_judge_analyst", "Analyst", 100],
      ["truth_judge_arbiter", "Arbiter", 300],
      ["truth_judge_master", "Master", 1000],
    ],
  ],
  [
    "SentenceCompletion",
    "Blank Sniper",
    "crosshair",
    "Sentence Completion",
    [
      ["blank_sniper_scout", "Scout", 20],
      ["blank_sniper_marksman", "Marksman", 100],
      ["blank_sniper_deadeye", "Deadeye", 300],
      ["blank_sniper_legend", "Legend", 1000],
    ],
  ],
  [
    "ShortAnswer",
    "Short Answer Rogue",
    "pencil",
    "Short Answer",
    [
      ["short_answer_rogue_scout", "Scout", 20],
      ["short_answer_rogue_striker", "Striker", 100],
      ["short_answer_rogue_assassin", "Assassin", 300],
      ["short_answer_rogue_shadow", "Shadow", 1000],
    ],
  ],
  [
    "Matching",
    "Matchmaker",
    "map",
    "Matching",
    [
      ["matchmaker_pathfinder", "Pathfinder", 20],
      ["matchmaker_tracker", "Tracker", 100],
      ["matchmaker_navigator", "Navigator", 300],
      ["matchmaker_cartographer", "Cartographer", 1000],
    ],
  ],
];

const typeAccuracy: Array<[QuestionType, string, string, string, Array<[string, string, number, number]>]> = [
  [
    "MCQ",
    "MCQ Deadeye",
    "target",
    "MCQ",
    [
      ["mcq_deadeye_bronze", "Bronze", 50, 0.7],
      ["mcq_deadeye_silver", "Silver", 100, 0.8],
      ["mcq_deadeye_gold", "Gold", 200, 0.9],
    ],
  ],
  [
    "TFNG",
    "Truth Tribunal",
    "scale",
    "TFNG",
    [
      ["truth_tribunal_bronze", "Bronze", 50, 0.7],
      ["truth_tribunal_silver", "Silver", 100, 0.8],
      ["truth_tribunal_gold", "Gold", 200, 0.9],
    ],
  ],
  [
    "SentenceCompletion",
    "Blank Lockpick",
    "key",
    "Sentence Completion",
    [
      ["blank_lockpick_bronze", "Bronze", 50, 0.7],
      ["blank_lockpick_silver", "Silver", 100, 0.8],
      ["blank_lockpick_gold", "Gold", 200, 0.9],
    ],
  ],
  [
    "ShortAnswer",
    "Short Answer Sharpshooter",
    "crosshair",
    "Short Answer",
    [
      ["short_answer_sharpshooter_bronze", "Bronze", 50, 0.7],
      ["short_answer_sharpshooter_silver", "Silver", 100, 0.8],
      ["short_answer_sharpshooter_gold", "Gold", 200, 0.9],
    ],
  ],
];

const bandAchievements: Array<[BandGroup, string, string, string, Array<[string, string, number]>]> = [
  [
    "Band6",
    "Band 6 Raider",
    "sword",
    "Band 6.0",
    [
      ["band_6_raider_scout", "Scout", 50],
      ["band_6_raider_striker", "Striker", 200],
      ["band_6_raider_clear", "Clear", 500],
    ],
  ],
  [
    "Band7",
    "Band 7 Climber",
    "mountain",
    "Band 7.0",
    [
      ["band_7_climber_basecamp", "Basecamp", 50],
      ["band_7_climber_summit_push", "Summit Push", 200],
      ["band_7_climber_peak_clear", "Peak Clear", 500],
    ],
  ],
  [
    "Band75",
    "Band 7.5 Hunter",
    "search",
    "Band 7.5",
    [
      ["band_75_hunter_trail", "Trail", 50],
      ["band_75_hunter_chase", "Chase", 200],
      ["band_75_hunter_claim", "Claim", 500],
    ],
  ],
  [
    "Band8Plus",
    "Band 8 Boss Slayer",
    "crown",
    "Band 8.0+",
    [
      ["band_8_boss_slayer_first_clear", "First Clear", 25],
      ["band_8_boss_slayer_hard_mode", "Hard Mode", 100],
      ["band_8_boss_slayer_nightmare_clear", "Nightmare Clear", 300],
    ],
  ],
];

type AchievementDefinitionBase = Omit<AchievementDefinition, "achievementXp">;

function resolveTierWeight(tier: string) {
  const normalized = normalizeString(tier);
  if (["tutorial", "first", "sampler", "spark", "scout", "trail", "basecamp", "bronze"].some((token) => normalized.includes(token))) {
    return 1;
  }
  if (["rookie", "adept", "explorer", "silver", "striker", "chase"].some((token) => normalized.includes(token))) {
    return 1.25;
  }
  if (["runner", "specialist", "gold", "claim", "summit", "hard_mode", "precision"].some((token) => normalized.includes(token))) {
    return 1.55;
  }
  if (["veteran", "master", "elite", "platinum", "nightmare", "momentum", "legend"].some((token) => normalized.includes(token))) {
    return 1.95;
  }
  if (["machine", "mythic", "diamond", "surgical", "rocket", "grandmaster", "challenger", "overlord"].some((token) => normalized.includes(token))) {
    return 2.5;
  }
  return 1.35;
}

function resolveCategoryWeight(category: AchievementCategory) {
  switch (category) {
    case "core_progress":
    case "correct_answers":
      return 1.2;
    case "streak":
    case "practice_streak":
    case "exploration":
      return 1.35;
    case "daily_goal":
    case "collection":
    case "quality":
      return 1.1;
    case "ranked":
    case "lp_momentum":
    case "accuracy":
      return 1.65;
    case "comeback":
    case "question_type_accuracy":
    case "band_level":
      return 1.8;
    case "question_type_mastery":
      return 1.5;
    case "time_based":
      return 1.4;
    default:
      return 1.25;
  }
}

function resolvePhaseWeight(phase: AchievementPhase) {
  return phase === "v2" ? 1.25 : 1;
}

function computeAchievementXp(definition: AchievementDefinitionBase) {
  const baseXp = 24;
  const weighted = baseXp * resolveTierWeight(definition.tier) * resolveCategoryWeight(definition.category) * resolvePhaseWeight(definition.phase);
  const rounded = Math.round(weighted / 5) * 5;
  return Math.max(20, rounded);
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinitionBase[] = [
  ...coreProgress.map(([key, tier, title, target]) => ({
    key,
    family: "First Quest / Quest Grinder",
    tier,
    title,
    description: `Answer ${target.toLocaleString()} question${target === 1 ? "" : "s"}.`,
    category: "core_progress" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "totalQuestionsAnswered" as const, target },
    icon: "sparkles",
    phase: "v1" as const,
  })),
  ...correctAnswers.map(([key, tier, title, target]) => ({
    key,
    family: "Answer Slayer",
    tier,
    title,
    description: `Get ${target.toLocaleString()} correct answers.`,
    category: "correct_answers" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "totalCorrectAnswers" as const, target },
    icon: "target",
    phase: "v1" as const,
  })),
  ...correctStreaks.map(([key, tier, title, target]) => ({
    key,
    family: "Combo Chain",
    tier,
    title,
    description: `Get ${target} correct answers in a row.`,
    category: "streak" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "bestCorrectStreak" as const, target },
    icon: "flame",
    phase: "v1" as const,
  })),
  ...dailyGoals.map(([key, tier, title, target]) => ({
    key,
    family: "Daily Quest",
    tier,
    title,
    description: `Complete the daily goal ${target.toLocaleString()} time${target === 1 ? "" : "s"}.`,
    category: "daily_goal" as const,
    trigger: "DAILY_GOAL_COMPLETED" as const,
    condition: { type: "counter" as const, field: "dailyGoalHits" as const, target },
    icon: "calendar-check",
    phase: "v1" as const,
  })),
  ...practiceStreaks.map(([key, tier, title, target]) => ({
    key,
    family: "Login Streak",
    tier,
    title,
    description: `Practice ${target} days in a row.`,
    category: "practice_streak" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "bestPracticeStreakDays" as const, target },
    icon: "calendar-days",
    phase: "v1" as const,
  })),
  ...rankedClimber.map(([key, tier, title, rank]) => ({
    key,
    family: "Ranked Climber",
    tier,
    title,
    description: `Reach ${rank} rank.`,
    category: "ranked" as const,
    trigger: "RANK_UPDATED" as const,
    condition: { type: "rank_reached" as const, rank },
    icon: "trophy",
    phase: "v1" as const,
  })),
  ...savedPassages.map(([key, tier, title, target]) => ({
    key,
    family: "Knowledge Vault",
    tier,
    title,
    description: `Save ${target.toLocaleString()} passage${target === 1 ? "" : "s"}.`,
    category: "collection" as const,
    trigger: "PASSAGE_SAVED" as const,
    condition: { type: "counter" as const, field: "savedPassageCount" as const, target },
    icon: "bookmark",
    phase: "v1" as const,
  })),
  ...([
    ["mode_completionist_sampler", "Sampler", "Mode Completionist Sampler", 1],
    ["mode_completionist_explorer", "Explorer", "Mode Completionist Explorer", 20],
    ["mode_completionist_cartographer", "Cartographer", "Mode Completionist Cartographer", 100],
  ] as const).map(([key, tier, title, target]) => ({
    key,
    family: "Mode Completionist",
    tier,
    title,
    description: `Answer at least ${target} question${target === 1 ? "" : "s"} of every question type.`,
    category: "exploration" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: {
      type: "all_nested_counters_at_least" as const,
      field: "questionTypeAttempts" as const,
      target: Number(target),
    },
    icon: "compass",
    phase: "v1" as const,
  })),
  ...([
    ["difficulty_completionist_sampler", "Sampler", "Difficulty Completionist Sampler", 1],
    ["difficulty_completionist_explorer", "Explorer", "Difficulty Completionist Explorer", 25],
    ["difficulty_completionist_cartographer", "Cartographer", "Difficulty Completionist Cartographer", 100],
  ] as const).map(([key, tier, title, target]) => ({
    key,
    family: "Difficulty Completionist",
    tier,
    title,
    description: `Answer at least ${target} question${target === 1 ? "" : "s"} in every band group.`,
    category: "exploration" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: {
      type: "all_nested_counters_at_least" as const,
      field: "bandAttempts" as const,
      target: Number(target),
    },
    icon: "layers",
    phase: "v1" as const,
  })),
  ...([
    ["deadeye_reader_steady_aim", "Steady Aim", "Deadeye Reader Steady Aim", 50, 0.6],
    ["deadeye_reader_reliable_shot", "Reliable Shot", "Deadeye Reader Reliable Shot", 100, 0.7],
    ["deadeye_reader_precision_mode", "Precision Mode", "Deadeye Reader Precision Mode", 200, 0.8],
    ["deadeye_reader_surgical", "Surgical", "Deadeye Reader Surgical", 300, 0.9],
  ] as const).map(([key, tier, title, minAttempts, accuracy]) => ({
    key,
    family: "Deadeye Reader",
    tier,
    title,
    description: `Reach ${Math.round(Number(accuracy) * 100)}% lifetime accuracy after ${Number(minAttempts).toLocaleString()} answers.`,
    category: "accuracy" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: {
      type: "accuracy" as const,
      attemptsField: "totalQuestionsAnswered" as const,
      correctField: "totalCorrectAnswers" as const,
      minAttempts: Number(minAttempts),
      accuracy: Number(accuracy),
    },
    icon: "crosshair",
    phase: "v2" as const,
  })),
  ...([
    ["last20_hot_hand", "Hot Hand", "Last 20 Hot Hand", "last20", 20, 0.9],
    ["last20_perfect_burst", "Perfect Burst", "Last 20 Perfect Burst", "last20", 20, 1],
    ["last50_ice_brain", "Ice Brain", "Last 50 Ice Brain", "last50", 50, 0.9],
    ["last100_machine_focus", "Machine Focus", "Last 100 Machine Focus", "last100", 100, 0.85],
  ] as const).map(([key, tier, title, window, minAttempts, accuracy]) => ({
    key,
    family: "Rolling Accuracy",
    tier,
    title,
    description: `Reach ${Math.round(Number(accuracy) * 100)}% accuracy across your ${String(window).replace("last", "last ")} answers.`,
    category: "accuracy" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: {
      type: "rolling_accuracy" as const,
      window: window as RollingWindowKey,
      minAttempts: Number(minAttempts),
      accuracy: Number(accuracy),
    },
    icon: "activity",
    phase: "v2" as const,
  })),
  ...typeMastery.flatMap(([questionType, family, icon, label, tiers]) =>
    tiers.map(([key, tier, target]) => ({
      key,
      family,
      tier,
      title: `${family} ${tier}`,
      description: `Answer ${target.toLocaleString()} ${label} question${target === 1 ? "" : "s"}.`,
      category: "question_type_mastery" as const,
      trigger: "ANSWER_SUBMITTED" as const,
      condition: {
        type: "nested_counter" as const,
        field: "questionTypeAttempts" as const,
        key: questionType,
        target,
      },
      icon,
      phase: "v2" as const,
    })),
  ),
  ...typeAccuracy.flatMap(([questionType, family, icon, label, tiers]) =>
    tiers.map(([key, tier, minAttempts, accuracy]) => ({
      key,
      family,
      tier,
      title: `${family} ${tier}`,
      description: `Reach ${Math.round(accuracy * 100)}% ${label} accuracy after ${minAttempts} attempts.`,
      category: "question_type_accuracy" as const,
      trigger: "ANSWER_SUBMITTED" as const,
      condition: {
        type: "nested_accuracy" as const,
        attemptsField: "questionTypeAttempts" as const,
        correctField: "questionTypeCorrect" as const,
        key: questionType,
        minAttempts,
        accuracy,
      },
      icon,
      phase: "v2" as const,
    })),
  ),
  ...bandAchievements.flatMap(([bandGroup, family, icon, label, tiers]) =>
    tiers.map(([key, tier, target]) => ({
      key,
      family,
      tier,
      title: `${family} ${tier}`,
      description: `Answer ${target.toLocaleString()} ${label} question${target === 1 ? "" : "s"}.`,
      category: "band_level" as const,
      trigger: "ANSWER_SUBMITTED" as const,
      condition: {
        type: "nested_counter" as const,
        field: "bandAttempts" as const,
        key: bandGroup,
        target,
      },
      icon,
      phase: "v2" as const,
    })),
  ),
  ...([
    ["lp_rush_spark", "Spark", "LP Rush Spark", 25],
    ["lp_rush_power_spike", "Power Spike", "LP Rush Power Spike", 75],
    ["lp_rush_momentum_surge", "Momentum Surge", "LP Rush Momentum Surge", 150],
    ["lp_rush_rocket_day", "Rocket Day", "LP Rush Rocket Day", 300],
  ] as const).map(([key, tier, title, target]) => ({
    key,
    family: "LP Rush",
    tier,
    title,
    description: `Gain ${Number(target)} LP in one local day.`,
    category: "lp_momentum" as const,
    trigger: "LP_GAINED" as const,
    condition: { type: "counter" as const, field: "bestSingleDayLPGain" as const, target: Number(target) },
    icon: "rocket",
    phase: "v2" as const,
  })),
  ...([
    ["clutch_mode_reset", "Reset", "Clutch Mode Reset", 2, 3],
    ["clutch_mode_stabilized", "Stabilized", "Clutch Mode Stabilized", 3, 5],
    ["clutch_mode_mental_fortress", "Mental Fortress", "Clutch Mode Mental Fortress", 5, 10],
  ] as const).map(([key, tier, title, wrongs, corrects]) => ({
    key,
    family: "Clutch Mode",
    tier,
    title,
    description: `Get ${Number(corrects)} correct answers immediately after ${Number(wrongs)} wrong answers.`,
    category: "comeback" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: {
      type: "comeback" as const,
      requiredWrongStreak: Number(wrongs),
      requiredCorrectStreak: Number(corrects),
    },
    icon: "shield",
    phase: "v2" as const,
  })),
  ...([
    ["tilt_proof_first_save", "First Save", "Tilt Proof First Save", 1],
    ["tilt_proof_composed", "Composed", "Tilt Proof Composed", 25],
    ["tilt_proof_unshaken", "Unshaken", "Tilt Proof Unshaken", 100],
  ] as const).map(([key, tier, title, target]) => ({
    key,
    family: "Tilt Proof",
    tier,
    title,
    description: `Answer correctly right after a wrong answer ${Number(target)} time${Number(target) === 1 ? "" : "s"}.`,
    category: "comeback" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "damageControlCount" as const, target: Number(target) },
    icon: "shield-check",
    phase: "v2" as const,
  })),
  ...([
    ["bug_hunter_first_flag", "First Flag", "Bug Hunter First Flag", 1],
    ["bug_hunter_sharp_eye", "Sharp Eye", "Bug Hunter Sharp Eye", 5],
    ["bug_hunter_qa_demon", "QA Demon", "Bug Hunter QA Demon", 20],
  ] as const).map(([key, tier, title, target]) => ({
    key,
    family: "Bug Hunter",
    tier,
    title,
    description: `Submit ${Number(target)} passage report${Number(target) === 1 ? "" : "s"}.`,
    category: "quality" as const,
    trigger: "REPORT_SUBMITTED" as const,
    condition: { type: "counter" as const, field: "reportCount" as const, target: Number(target) },
    icon: "flag",
    phase: "v2" as const,
  })),
  ...([
    ["dawn_grinder_morning_tap", "Morning Tap", "Dawn Grinder Morning Tap", "earlyBirdDays", 1],
    ["dawn_grinder_sunrise_streak", "Sunrise Streak", "Dawn Grinder Sunrise Streak", "earlyBirdDays", 5],
    ["midnight_queue_late_tap", "Late Tap", "Midnight Queue Late Tap", "nightOwlDays", 1],
    ["midnight_queue_midnight_scholar", "Midnight Scholar", "Midnight Queue Midnight Scholar", "nightOwlDays", 5],
    ["weekend_raid_saturday_clear", "Saturday Clear", "Weekend Raid Saturday Clear", "weekendPracticeDays", 1],
    ["weekend_raid_weekend_habit", "Weekend Habit", "Weekend Raid Weekend Habit", "weekendPracticeDays", 10],
  ] as const).map(([key, tier, title, field, target]) => ({
    key,
    family: String(title).split(" ").slice(0, -1).join(" "),
    tier,
    title,
    description: `Practice on ${Number(target)} matching local day${Number(target) === 1 ? "" : "s"}.`,
    category: "time_based" as const,
    trigger: "ANSWER_SUBMITTED" as const,
    condition: { type: "counter" as const, field: field as keyof UserAchievementProgress, target: Number(target) },
    icon: "clock",
    phase: "v2" as const,
  })),
];

export const ACHIEVEMENTS: AchievementDefinition[] = ACHIEVEMENT_DEFINITIONS.map(
  (achievement) => ({
    ...achievement,
    achievementXp: computeAchievementXp(achievement),
  }),
);

export function evaluateAchievementCondition(
  achievement: AchievementDefinition,
  progress: UserAchievementProgress,
) {
  const { condition } = achievement;
  switch (condition.type) {
    case "counter": {
      const value = progress[condition.field];
      return typeof value === "number" && value >= condition.target;
    }
    case "nested_counter": {
      const value = progress[condition.field] as Record<string, number>;
      return (value[condition.key] ?? 0) >= condition.target;
    }
    case "accuracy": {
      const attempts = progress[condition.attemptsField];
      const correct = progress[condition.correctField];
      if (typeof attempts !== "number" || typeof correct !== "number") return false;
      return attempts >= condition.minAttempts && correct / attempts >= condition.accuracy;
    }
    case "nested_accuracy": {
      const attempts = progress[condition.attemptsField][condition.key] ?? 0;
      const correct = progress[condition.correctField][condition.key] ?? 0;
      return attempts >= condition.minAttempts && correct / attempts >= condition.accuracy;
    }
    case "rank_reached":
      return RANK_ORDER[progress.currentRank] >= RANK_ORDER[condition.rank];
    case "all_nested_counters_at_least":
      return Object.values(progress[condition.field]).every((count) => count >= condition.target);
    case "comeback":
      return (
        progress.lastWrongStreakBeforeRecovery >= condition.requiredWrongStreak &&
        progress.currentRecoveryCorrectStreak >= condition.requiredCorrectStreak
      );
    case "rolling_accuracy": {
      const windowValue = progress.rollingWindows[condition.window] ?? "";
      return (
        windowValue.length >= condition.minAttempts &&
        rollingAccuracy(windowValue) >= condition.accuracy
      );
    }
  }
}

export function unlockAchievementsForTriggers(
  progress: UserAchievementProgress,
  triggers: AchievementTrigger[],
  activePhase: AchievementPhase = "v2",
) {
  const phaseOrder: Record<AchievementPhase, number> = {
    v1: 1,
    v2: 2,
  };
  const activePhaseOrder = phaseOrder[activePhase] ?? 1;
  const unlockedKeySet = new Set(progress.unlockedAchievementKeys);
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (achievement) =>
      phaseOrder[achievement.phase] <= activePhaseOrder &&
      triggers.includes(achievement.trigger) &&
      !unlockedKeySet.has(achievement.key) &&
      evaluateAchievementCondition(achievement, progress),
  );

  if (newlyUnlocked.length === 0) {
    return {
      progress,
      newlyUnlocked,
    };
  }

  return {
    progress: {
      ...progress,
      unlockedAchievementKeys: [
        ...progress.unlockedAchievementKeys,
        ...newlyUnlocked.map((achievement) => achievement.key),
      ],
    },
    newlyUnlocked,
  };
}

export function applyAnswerAchievementProgress(
  previousProgress: UserAchievementProgress,
  isCorrect: boolean,
  context: AnswerAchievementContext,
) {
  const now = context.now ?? new Date();
  const today = formatAchievementDayKey(now);
  const questionType = context.questionType
    ? normalizeQuestionType(context.questionType)
    : null;
  const bandGroup = context.band !== undefined ? normalizeBandGroup(context.band) : null;
  const lastPracticeDate = previousProgress.lastPracticeDateLocal;
  const practiceDayDifference = lastPracticeDate
    ? getDayDifference(lastPracticeDate, today)
    : null;
  const isNewPracticeDay = lastPracticeDate !== today;
  const currentPracticeStreakDays = isNewPracticeDay
    ? practiceDayDifference === null || practiceDayDifference === 1
      ? previousProgress.currentPracticeStreakDays + 1
      : 1
    : previousProgress.currentPracticeStreakDays;
  const isNewDailyAnswerDay = previousProgress.lastDailyAnswerDateLocal !== today;
  const dailyAnsweredCountBefore = isNewDailyAnswerDay
    ? 0
    : previousProgress.dailyAnsweredCount;
  const dailyAnsweredCount = dailyAnsweredCountBefore + 1;
  const completedDailyGoal =
    dailyAnsweredCountBefore < context.dailyGoalTarget &&
    dailyAnsweredCount >= context.dailyGoalTarget &&
    previousProgress.lastDailyGoalDateLocal !== today;
  const nextQuestionTypeAttempts = { ...previousProgress.questionTypeAttempts };
  const nextQuestionTypeCorrect = { ...previousProgress.questionTypeCorrect };
  const nextAnsweredQuestionTypes = { ...previousProgress.answeredQuestionTypes };
  const nextBandAttempts = { ...previousProgress.bandAttempts };
  const nextBandCorrect = { ...previousProgress.bandCorrect };
  const nextAnsweredBandGroups = { ...previousProgress.answeredBandGroups };

  if (questionType) {
    nextQuestionTypeAttempts[questionType] += 1;
    nextQuestionTypeCorrect[questionType] += isCorrect ? 1 : 0;
    nextAnsweredQuestionTypes[questionType] = true;
  }

  if (bandGroup) {
    nextBandAttempts[bandGroup] += 1;
    nextBandCorrect[bandGroup] += isCorrect ? 1 : 0;
    nextAnsweredBandGroups[bandGroup] = true;
  }

  const totalQuestionsAnswered = previousProgress.totalQuestionsAnswered + 1;
  const totalCorrectAnswers = previousProgress.totalCorrectAnswers + (isCorrect ? 1 : 0);
  const totalWrongAnswers = previousProgress.totalWrongAnswers + (isCorrect ? 0 : 1);
  const currentCorrectStreak = isCorrect
    ? previousProgress.currentCorrectStreak + 1
    : 0;
  let currentWrongStreak = previousProgress.currentWrongStreak;
  let lastWrongStreakBeforeRecovery = previousProgress.lastWrongStreakBeforeRecovery;
  let currentRecoveryCorrectStreak = previousProgress.currentRecoveryCorrectStreak;

  if (isCorrect) {
    if (previousProgress.currentWrongStreak > 0) {
      lastWrongStreakBeforeRecovery = previousProgress.currentWrongStreak;
      currentWrongStreak = 0;
      currentRecoveryCorrectStreak = 1;
    } else if (lastWrongStreakBeforeRecovery > 0) {
      currentRecoveryCorrectStreak += 1;
    }
  } else {
    currentWrongStreak = previousProgress.currentWrongStreak + 1;
    lastWrongStreakBeforeRecovery = currentWrongStreak;
    currentRecoveryCorrectStreak = 0;
  }

  const earlyBirdDateKeys =
    now.getHours() < 7 && !previousProgress.earlyBirdDateKeys.includes(today)
      ? [...previousProgress.earlyBirdDateKeys, today]
      : previousProgress.earlyBirdDateKeys;
  const nightOwlDateKeys =
    now.getHours() >= 23 && !previousProgress.nightOwlDateKeys.includes(today)
      ? [...previousProgress.nightOwlDateKeys, today]
      : previousProgress.nightOwlDateKeys;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const weekendPracticeDateKeys =
    isWeekend && !previousProgress.weekendPracticeDateKeys.includes(today)
      ? [...previousProgress.weekendPracticeDateKeys, today]
      : previousProgress.weekendPracticeDateKeys;

  const nextProgress: UserAchievementProgress = {
    ...previousProgress,
    totalQuestionsAnswered,
    totalCorrectAnswers,
    totalWrongAnswers,
    lifetimeAccuracy: totalCorrectAnswers / totalQuestionsAnswered,
    currentCorrectStreak,
    bestCorrectStreak: Math.max(previousProgress.bestCorrectStreak, currentCorrectStreak),
    currentWrongStreak,
    previousAnswerWasWrong: !isCorrect,
    lastWrongStreakBeforeRecovery,
    currentRecoveryCorrectStreak,
    damageControlCount:
      previousProgress.damageControlCount +
      (previousProgress.previousAnswerWasWrong && isCorrect ? 1 : 0),
    dailyGoalHits: previousProgress.dailyGoalHits + (completedDailyGoal ? 1 : 0),
    dailyAnsweredCount,
    lastDailyAnswerDateLocal: today,
    lastDailyGoalDateLocal: completedDailyGoal
      ? today
      : previousProgress.lastDailyGoalDateLocal,
    currentPracticeStreakDays,
    bestPracticeStreakDays: Math.max(
      previousProgress.bestPracticeStreakDays,
      currentPracticeStreakDays,
    ),
    lastPracticeDateLocal: today,
    questionTypeAttempts: nextQuestionTypeAttempts,
    questionTypeCorrect: nextQuestionTypeCorrect,
    bandAttempts: nextBandAttempts,
    bandCorrect: nextBandCorrect,
    answeredQuestionTypes: nextAnsweredQuestionTypes,
    answeredBandGroups: nextAnsweredBandGroups,
    rollingWindows: {
      last20: updateRollingWindow(previousProgress.rollingWindows.last20, isCorrect, 20),
      last50: updateRollingWindow(previousProgress.rollingWindows.last50, isCorrect, 50),
      last100: updateRollingWindow(previousProgress.rollingWindows.last100, isCorrect, 100),
    },
    earlyBirdDateKeys,
    nightOwlDateKeys,
    weekendPracticeDateKeys,
    earlyBirdDays: earlyBirdDateKeys.length,
    nightOwlDays: nightOwlDateKeys.length,
    weekendPracticeDays: weekendPracticeDateKeys.length,
  };

  const triggers: AchievementTrigger[] = ["ANSWER_SUBMITTED"];
  if (completedDailyGoal) {
    triggers.push("DAILY_GOAL_COMPLETED");
  }

  return {
    progress: nextProgress,
    triggers,
  };
}

export function applyRankedAchievementProgress(
  previousProgress: UserAchievementProgress,
  context: RankedAchievementContext,
) {
  const now = context.now ?? new Date();
  const today = formatAchievementDayKey(now);
  const nextRank = sanitizeRank(context.rank);
  const lpDelta = Number(context.lpDelta ?? 0);
  const rankedPointsAfter =
    typeof context.rankedPointsAfter === "number"
      ? Math.max(0, Math.trunc(context.rankedPointsAfter))
      : Math.max(0, previousProgress.currentLP + Math.trunc(lpDelta));
  const isNewLPDay = previousProgress.lastLPDateLocal !== today;
  const dailyLPGained = isNewLPDay ? 0 : previousProgress.dailyLPGained;
  const positiveLPGain = Math.max(0, Math.trunc(lpDelta));
  const nextDailyLPGained = dailyLPGained + positiveLPGain;

  const nextProgress: UserAchievementProgress = {
    ...previousProgress,
    currentRank: nextRank,
    currentLP: rankedPointsAfter,
    dailyLPGained: nextDailyLPGained,
    bestSingleDayLPGain: Math.max(
      previousProgress.bestSingleDayLPGain,
      nextDailyLPGained,
    ),
    lastLPDateLocal: positiveLPGain > 0 ? today : previousProgress.lastLPDateLocal,
  };

  return {
    progress: nextProgress,
    triggers: [
      "RANK_UPDATED",
      ...(positiveLPGain > 0 ? (["LP_GAINED"] as const) : []),
    ] satisfies AchievementTrigger[],
  };
}

export function applySavedPassageAchievementProgress(
  previousProgress: UserAchievementProgress,
  savedPassageCount: number,
) {
  return {
    progress: {
      ...previousProgress,
      savedPassageCount: Math.max(
        previousProgress.savedPassageCount,
        Math.max(0, Math.trunc(savedPassageCount)),
      ),
    },
    triggers: ["PASSAGE_SAVED"] satisfies AchievementTrigger[],
  };
}

export function applyReportAchievementProgress(previousProgress: UserAchievementProgress) {
  return {
    progress: {
      ...previousProgress,
      reportCount: previousProgress.reportCount + 1,
    },
    triggers: ["REPORT_SUBMITTED"] satisfies AchievementTrigger[],
  };
}

export function getAchievementDefinitionByKey(key: string) {
  return ACHIEVEMENTS.find((achievement) => achievement.key === key) ?? null;
}

export function mergeAchievementUnlockKeys(
  localKeys: string[],
  remoteKeys: string[],
) {
  const merged = new Set<string>();
  for (const key of [...localKeys, ...remoteKeys]) {
    if (typeof key !== "string") continue;
    const normalized = key.trim();
    if (!normalized) continue;
    merged.add(normalized);
  }
  return [...merged];
}

export function buildAchievementUnlockSyncPayload(unlockedKeys: string[]) {
  const uniqueKeys = new Set(unlockedKeys);
  const payload: Array<{
    key: string;
    title: string;
    category: string;
    tier: string;
    xp: number;
  }> = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!uniqueKeys.has(achievement.key)) continue;
    payload.push({
      key: achievement.key,
      title: achievement.title,
      category: achievement.category,
      tier: achievement.tier,
      xp: achievement.achievementXp,
    });
  }
  return payload;
}

export function calculateAchievementXpFromKeys(unlockedKeys: string[]) {
  const keySet = new Set(unlockedKeys);
  return ACHIEVEMENTS.reduce((sum, achievement) => {
    if (!keySet.has(achievement.key)) {
      return sum;
    }
    return sum + Math.max(0, achievement.achievementXp);
  }, 0);
}

export function getAchievementLevelProgress(totalXp: number): AchievementLevelProgress {
  const safeXp = Number.isFinite(totalXp) ? Math.max(0, Math.trunc(totalXp)) : 0;
  let levelIndex = 0;
  for (let index = 0; index < ACHIEVEMENT_LEVEL_THRESHOLDS.length; index += 1) {
    if (safeXp >= ACHIEVEMENT_LEVEL_THRESHOLDS[index]) {
      levelIndex = index;
    } else {
      break;
    }
  }
  const currentLevelXpFloor = ACHIEVEMENT_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const nextLevelXpFloor = ACHIEVEMENT_LEVEL_THRESHOLDS[levelIndex + 1] ?? null;
  const xpIntoLevel = safeXp - currentLevelXpFloor;
  const xpRange = nextLevelXpFloor === null ? 1 : Math.max(1, nextLevelXpFloor - currentLevelXpFloor);
  const progressPercent =
    nextLevelXpFloor === null
      ? 100
      : Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpRange) * 100)));

  return {
    totalXp: safeXp,
    currentLevel: levelIndex + 1,
    currentLevelXpFloor,
    nextLevelXpFloor,
    xpIntoLevel: Math.max(0, xpIntoLevel),
    xpNeededForNextLevel:
      nextLevelXpFloor === null ? 0 : Math.max(0, nextLevelXpFloor - safeXp),
    progressPercent,
  };
}
