import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const QUESTION_SET_TYPE_VALUES = [
  "tfng",
  "mcq",
  "sentence_completion",
  "short_answer",
  "mixed",
] as const;

export const QUESTION_TYPE_VALUES = [
  "tfng",
  "mcq",
  "sentence_completion",
  "short_answer",
] as const;

export const ANSWER_TYPE_VALUES = ["label", "option_key", "text"] as const;

export const ANSWER_STAT_BAND_GROUP_VALUES = [
  "Band6",
  "Band7",
  "Band75",
  "Band8Plus",
] as const;

export const ANSWER_STAT_QUESTION_TYPE_VALUES = [
  "MCQ",
  "TFNG",
  "SentenceCompletion",
  "ShortAnswer",
  "Matching",
] as const;

export type QuestionSetTypeIndex = (typeof QUESTION_SET_TYPE_VALUES)[number];
export type QuestionTypeIndex = (typeof QUESTION_TYPE_VALUES)[number];
export type AnswerTypeIndex = (typeof ANSWER_TYPE_VALUES)[number];
export type AnswerStatBandGroup = (typeof ANSWER_STAT_BAND_GROUP_VALUES)[number];
export type AnswerStatQuestionType =
  (typeof ANSWER_STAT_QUESTION_TYPE_VALUES)[number];
export type PassageVocabItem = {
  term: string;
  definition: string;
  simple_meaning_en?: string;
  example_sentence_en?: string;
  meaning_vi?: string;
  sentence_index?: number;
};

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id").primaryKey(),
    publicUserId: text("public_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_profiles_public_user_id_uidx").on(table.publicUserId),
    uniqueIndex("user_profiles_email_uidx").on(table.email),
    index("user_profiles_email_idx").on(table.email),
  ],
);

export const userProgress = pgTable(
  "user_progress",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    lifetimeXp: integer("lifetime_xp").notNull().default(0),
    rankedPoints: integer("ranked_points").notNull().default(0),
    currentRank: text("current_rank").notNull().default("Bronze"),
    totalQuestionsAnswered: integer("total_questions_answered").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalIncorrect: integer("total_incorrect").notNull().default(0),
    currentPracticeStreakDays: integer("current_practice_streak_days")
      .notNull()
      .default(0),
    bestPracticeStreakDays: integer("best_practice_streak_days")
      .notNull()
      .default(0),
    lastPracticeDateLocal: date("last_practice_date_local"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_progress_ranked_points_idx").on(table.rankedPoints, table.totalCorrect),
    index("user_progress_rank_leaderboard_idx").on(
      table.currentRank,
      table.rankedPoints,
      table.totalCorrect,
    ),
    check("user_progress_lifetime_xp_nonnegative_chk", sql`${table.lifetimeXp} >= 0`),
    check("user_progress_ranked_points_nonnegative_chk", sql`${table.rankedPoints} >= 0`),
    check(
      "user_progress_totals_nonnegative_chk",
      sql`${table.totalQuestionsAnswered} >= 0 AND ${table.totalCorrect} >= 0 AND ${table.totalIncorrect} >= 0`,
    ),
    check(
      "user_progress_practice_streak_nonnegative_chk",
      sql`${table.currentPracticeStreakDays} >= 0 AND ${table.bestPracticeStreakDays} >= 0`,
    ),
    check(
      "user_progress_current_rank_chk",
      sql`${table.currentRank} in ('Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Challenger')`,
    ),
  ],
);

export const rankTiers = pgTable(
  "rank_tiers",
  {
    key: text("key").primaryKey(),
    label: text("label").notNull(),
    minPoints: integer("min_points").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("rank_tiers_sort_order_uidx").on(table.sortOrder),
    check("rank_tiers_min_points_nonnegative_chk", sql`${table.minPoints} >= 0`),
    check("rank_tiers_sort_order_nonnegative_chk", sql`${table.sortOrder} >= 0`),
  ],
);

export const userDailyAnswerStats = pgTable(
  "user_daily_answer_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    bandGroup: text("band_group").notNull().$type<AnswerStatBandGroup>(),
    questionType: text("question_type").notNull().$type<AnswerStatQuestionType>(),
    attemptCount: integer("attempt_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_daily_answer_stats_user_date_idx").on(table.userId, table.localDate),
    index("user_daily_answer_stats_user_category_idx").on(
      table.userId,
      table.bandGroup,
      table.questionType,
    ),
    check(
      "user_daily_answer_stats_counts_nonnegative_chk",
      sql`${table.attemptCount} >= 0 AND ${table.correctCount} >= 0 AND ${table.wrongCount} >= 0`,
    ),
    check(
      "user_daily_answer_stats_counts_match_chk",
      sql`${table.attemptCount} = ${table.correctCount} + ${table.wrongCount}`,
    ),
    check(
      "user_daily_answer_stats_band_group_chk",
      sql`${table.bandGroup} in ('Band6','Band7','Band75','Band8Plus')`,
    ),
    check(
      "user_daily_answer_stats_question_type_chk",
      sql`${table.questionType} in ('MCQ','TFNG','SentenceCompletion','ShortAnswer','Matching')`,
    ),
  ],
);

export const passages = pgTable(
  "passages",
  {
    id: text("id").primaryKey(),
    schemaVersion: text("schema_version").notNull(),
    examIndex: text("exam_index").notNull(),
    examLabel: text("exam_label").notNull(),
    bandIndex: integer("band_index").notNull(),
    bandLabel: text("band_label").notNull(),
    questionSetTypeIndex: text("question_set_type_index").notNull(),
    questionSetTypeLabel: text("question_set_type_label").notNull(),
    topicIndex: text("topic_index").notNull(),
    topicLabel: text("topic_label").notNull(),
    title: text("title").notNull(),
    factoryTag: text("factory_tag").notNull().default("v1"),
    languageCode: text("language_code").notNull(),
    status: text("status").notNull(),
    passage: text("passage").notNull(),
    passageMetaSentenceCount: integer("passage_meta_sentence_count").notNull(),
    passageMetaWordCount: integer("passage_meta_word_count").notNull(),
    vocabJson: jsonb("vocab_json")
      .$type<PassageVocabItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("passages_band_idx").on(table.bandIndex),
    index("passages_question_set_type_idx").on(table.questionSetTypeIndex),
    index("passages_topic_idx").on(table.topicIndex),
    index("passages_factory_tag_idx").on(table.factoryTag),
    index("passages_status_idx").on(table.status),
    index("passages_language_code_idx").on(table.languageCode),
    check(
      "passages_question_set_type_chk",
      sql`${table.questionSetTypeIndex} in ('tfng','mcq','sentence_completion','short_answer','mixed')`,
    ),
  ],
);

export const passageReportCounts = pgTable(
  "passage_report_counts",
  {
    passageId: text("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("passage_report_counts_passage_type_uidx").on(
      table.passageId,
      table.reportType,
    ),
    index("passage_report_counts_passage_idx").on(table.passageId),
    check("passage_report_counts_nonnegative_chk", sql`${table.count} >= 0`),
  ],
);

export const passageReportFeedback = pgTable(
  "passage_report_feedback",
  {
    id: text("id").primaryKey(),
    passageId: text("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(),
    customFeedback: text("custom_feedback").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("passage_report_feedback_passage_idx").on(table.passageId, table.createdAt),
    check(
      "passage_report_feedback_length_chk",
      sql`char_length(${table.customFeedback}) >= 1 AND char_length(${table.customFeedback}) <= 500`,
    ),
  ],
);

export const userVocabBank = pgTable(
  "user_vocab_bank",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    normalizedTerm: text("normalized_term").notNull(),
    term: text("term").notNull(),
    meaningEn: text("meaning_en"),
    meaningVi: text("meaning_vi"),
    exampleSentenceEn: text("example_sentence_en"),
    sentenceIndex: integer("sentence_index"),
    sourcePassageId: text("source_passage_id").references(() => passages.id, {
      onDelete: "set null",
    }),
    sourcePassageTitle: text("source_passage_title"),
    sourceBandLabel: text("source_band_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "user_vocab_bank_pkey",
      columns: [table.userId, table.normalizedTerm],
    }),
    index("user_vocab_bank_user_created_idx").on(table.userId, table.createdAt),
    check("user_vocab_bank_term_nonempty_chk", sql`length(trim(${table.term})) > 0`),
    check(
      "user_vocab_bank_normalized_term_nonempty_chk",
      sql`length(trim(${table.normalizedTerm})) > 0`,
    ),
    check(
      "user_vocab_bank_sentence_index_positive_chk",
      sql`${table.sentenceIndex} is null or ${table.sentenceIndex} >= 1`,
    ),
  ],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    achievementKey: text("achievement_key").notNull(),
    achievementTitle: text("achievement_title").notNull(),
    achievementCategory: text("achievement_category").notNull(),
    achievementTier: text("achievement_tier").notNull(),
    achievementXp: integer("achievement_xp").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "user_achievements_pkey",
      columns: [table.userId, table.achievementKey],
    }),
    index("user_achievements_user_unlocked_idx").on(table.userId, table.unlockedAt),
    index("user_achievements_user_category_idx").on(
      table.userId,
      table.achievementCategory,
    ),
    check("user_achievements_key_nonempty_chk", sql`length(trim(${table.achievementKey})) > 0`),
    check(
      "user_achievements_title_nonempty_chk",
      sql`length(trim(${table.achievementTitle})) > 0`,
    ),
    check(
      "user_achievements_tier_nonempty_chk",
      sql`length(trim(${table.achievementTier})) > 0`,
    ),
    check("user_achievements_xp_nonnegative_chk", sql`${table.achievementXp} >= 0`),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    passageId: text("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    sourceQuestionId: integer("source_question_id").notNull(),
    orderIndex: integer("order_index").notNull(),
    questionTypeIndex: text("question_type_index").notNull(),
    questionTypeLabel: text("question_type_label").notNull(),
    prompt: text("prompt").notNull(),
    questionPayloadJson: jsonb("question_payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_passage_order_idx").on(table.passageId, table.orderIndex),
    index("questions_passage_type_idx").on(table.passageId, table.questionTypeIndex),
    uniqueIndex("questions_passage_source_question_uidx").on(
      table.passageId,
      table.sourceQuestionId,
    ),
    uniqueIndex("questions_passage_order_uidx").on(table.passageId, table.orderIndex),
    check(
      "questions_question_type_chk",
      sql`${table.questionTypeIndex} in ('tfng','mcq','sentence_completion','short_answer')`,
    ),
  ],
);

export const answerKeys = pgTable(
  "answer_keys",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    answerType: text("answer_type").notNull(),
    answerValue: text("answer_value").notNull(),
    acceptedValuesJson: jsonb("accepted_values_json").$type<string[] | null>(),
    explanation: text("explanation").notNull(),
    evidenceJson: jsonb("evidence_json")
      .$type<
        Array<{
          sentence_index: number;
          evidence_type: string;
          highlight_text?: string;
          explanation_role?: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("answer_keys_question_uidx").on(table.questionId),
    check(
      "answer_keys_answer_type_chk",
      sql`${table.answerType} in ('label','option_key','text')`,
    ),
  ],
);

export const userQuestionTimingEvents = pgTable(
  "user_question_timing_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    passageId: text("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    sourceQuestionId: integer("source_question_id").notNull(),
    displayPosition: integer("display_position").notNull(),
    elapsedSeconds: integer("elapsed_seconds").notNull(),
    localDate: date("local_date").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    bandGroup: text("band_group").notNull().$type<AnswerStatBandGroup>(),
    questionType: text("question_type").notNull().$type<AnswerStatQuestionType>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_question_timing_events_user_date_idx").on(table.userId, table.localDate),
    index("user_question_timing_events_user_passage_created_idx").on(
      table.userId,
      table.passageId,
      table.createdAt,
    ),
    index("user_question_timing_events_passage_position_idx").on(
      table.passageId,
      table.displayPosition,
    ),
    check(
      "user_question_timing_events_elapsed_seconds_chk",
      sql`${table.elapsedSeconds} >= 0 AND ${table.elapsedSeconds} <= 14400`,
    ),
    check(
      "user_question_timing_events_display_position_chk",
      sql`${table.displayPosition} >= 1`,
    ),
    check(
      "user_question_timing_events_band_group_chk",
      sql`${table.bandGroup} in ('Band6','Band7','Band75','Band8Plus')`,
    ),
    check(
      "user_question_timing_events_question_type_chk",
      sql`${table.questionType} in ('MCQ','TFNG','SentenceCompletion','ShortAnswer','Matching')`,
    ),
  ],
);

export const passagesRelations = relations(passages, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  passage: one(passages, {
    fields: [questions.passageId],
    references: [passages.id],
  }),
  answerKey: one(answerKeys, {
    fields: [questions.id],
    references: [answerKeys.questionId],
  }),
}));

export const answerKeysRelations = relations(answerKeys, ({ one }) => ({
  question: one(questions, {
    fields: [answerKeys.questionId],
    references: [questions.id],
  }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one, many }) => ({
  progress: one(userProgress, {
    fields: [userProfiles.userId],
    references: [userProgress.userId],
  }),
  achievements: many(userAchievements),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [userProgress.userId],
    references: [userProfiles.userId],
  }),
}));

export const userDailyAnswerStatsRelations = relations(
  userDailyAnswerStats,
  ({ one }) => ({
    profile: one(userProfiles, {
      fields: [userDailyAnswerStats.userId],
      references: [userProfiles.userId],
    }),
  }),
);

export const userQuestionTimingEventsRelations = relations(
  userQuestionTimingEvents,
  ({ one }) => ({
    profile: one(userProfiles, {
      fields: [userQuestionTimingEvents.userId],
      references: [userProfiles.userId],
    }),
    passage: one(passages, {
      fields: [userQuestionTimingEvents.passageId],
      references: [passages.id],
    }),
    question: one(questions, {
      fields: [userQuestionTimingEvents.questionId],
      references: [questions.id],
    }),
  }),
);

export const userVocabBankRelations = relations(userVocabBank, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [userVocabBank.userId],
    references: [userProfiles.userId],
  }),
  passage: one(passages, {
    fields: [userVocabBank.sourcePassageId],
    references: [passages.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [userAchievements.userId],
    references: [userProfiles.userId],
  }),
}));

export type Passage = typeof passages.$inferSelect;
export type NewPassage = typeof passages.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type AnswerKey = typeof answerKeys.$inferSelect;
export type NewAnswerKey = typeof answerKeys.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type RankTier = typeof rankTiers.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
export type UserDailyAnswerStat = typeof userDailyAnswerStats.$inferSelect;
export type NewUserDailyAnswerStat = typeof userDailyAnswerStats.$inferInsert;
export type UserQuestionTimingEvent = typeof userQuestionTimingEvents.$inferSelect;
export type NewUserQuestionTimingEvent = typeof userQuestionTimingEvents.$inferInsert;
export type UserVocabBankItem = typeof userVocabBank.$inferSelect;
export type NewUserVocabBankItem = typeof userVocabBank.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
