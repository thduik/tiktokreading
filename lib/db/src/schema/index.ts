import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
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

export type QuestionSetTypeIndex = (typeof QUESTION_SET_TYPE_VALUES)[number];
export type QuestionTypeIndex = (typeof QUESTION_TYPE_VALUES)[number];
export type AnswerTypeIndex = (typeof ANSWER_TYPE_VALUES)[number];
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("user_progress_lifetime_xp_nonnegative_chk", sql`${table.lifetimeXp} >= 0`),
    check("user_progress_ranked_points_nonnegative_chk", sql`${table.rankedPoints} >= 0`),
    check(
      "user_progress_totals_nonnegative_chk",
      sql`${table.totalQuestionsAnswered} >= 0 AND ${table.totalCorrect} >= 0 AND ${table.totalIncorrect} >= 0`,
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

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  progress: one(userProgress, {
    fields: [userProfiles.userId],
    references: [userProgress.userId],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [userProgress.userId],
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
