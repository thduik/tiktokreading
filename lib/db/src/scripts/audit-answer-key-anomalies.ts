import { and, eq, inArray, sql } from "drizzle-orm";
import { answerKeys, db, passages, pool, questions } from "../index";

type AuditRow = {
  passageId: string;
  title: string;
  questionId: string;
  sourceQuestionId: number;
  questionTypeIndex: string;
  questionPayloadJson: Record<string, unknown>;
  answerKeyId: string;
  answerType: string;
  answerValue: string;
  acceptedValuesJson: string[] | null;
};

type Anomaly = {
  passageId: string;
  title: string;
  questionId: string;
  sourceQuestionId: number;
  kind: string;
  before: string;
  after?: string;
  note?: string;
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripLeadingQuestionNumber(value: string) {
  return normalizeSpaces(value.replace(/^\s*\d+\s*[.)]\s*/g, ""));
}

function canonicalizeTfngLabel(value: string) {
  const stripped = stripLeadingQuestionNumber(value)
    .replace(/[-_]/g, " ")
    .toUpperCase();
  const compact = stripped.replace(/\s+/g, " ").trim();
  if (compact === "TRUE") return "TRUE";
  if (compact === "FALSE") return "FALSE";
  if (compact === "NOT GIVEN" || compact === "NOTGIVEN") return "NOT GIVEN";
  return compact;
}

function canonicalizeOptionKey(value: string) {
  const stripped = stripLeadingQuestionNumber(value).toUpperCase();
  const match = stripped.match(/^([A-Z])/);
  if (!match) {
    return stripped;
  }
  return match[1];
}

function canonicalizeTextAnswer(value: string) {
  return stripLeadingQuestionNumber(value);
}

function expectedAnswerType(questionTypeIndex: string) {
  if (questionTypeIndex === "tfng") return "label";
  if (questionTypeIndex === "mcq") return "option_key";
  if (
    questionTypeIndex === "sentence_completion" ||
    questionTypeIndex === "short_answer"
  ) {
    return "text";
  }
  return null;
}

function parseMcqOptionKeys(payload: Record<string, unknown>) {
  const rawOptions = payload.options;
  if (!Array.isArray(rawOptions)) {
    return new Set<string>();
  }

  const keys = new Set<string>();
  for (const option of rawOptions) {
    if (typeof option !== "object" || option === null) {
      continue;
    }
    const key = (option as { key?: unknown }).key;
    if (typeof key === "string" && key.trim().length > 0) {
      keys.add(key.trim().toUpperCase());
    }
  }
  return keys;
}

function normalizeAcceptedValues(questionTypeIndex: string, values: string[] | null) {
  if (!Array.isArray(values) || values.length === 0) {
    return values;
  }

  if (questionTypeIndex === "tfng") {
    return values.map(canonicalizeTfngLabel);
  }
  if (questionTypeIndex === "mcq") {
    return values.map(canonicalizeOptionKey);
  }
  return values.map(canonicalizeTextAnswer);
}

function equalStringArrays(left: string[] | null, right: string[] | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sampleArg = args.find((arg) => arg.startsWith("--sample="));
  const sampleSize = sampleArg ? Number(sampleArg.split("=")[1]) : 50;
  const targetTitleArg = args.find((arg) => arg.startsWith("--title="));
  const targetTitle = targetTitleArg
    ? decodeURIComponent(targetTitleArg.split("=")[1] ?? "").trim()
    : "Microgrid";

  if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
    throw new Error("--sample must be a positive integer.");
  }

  const randomPassages = await db
    .select({ id: passages.id, title: passages.title })
    .from(passages)
    .where(eq(passages.status, "active"))
    .orderBy(sql`random()`)
    .limit(sampleSize);

  const targetPassages = await db
    .select({ id: passages.id, title: passages.title })
    .from(passages)
    .where(
      and(
        eq(passages.status, "active"),
        sql`${passages.title} ILIKE ${`%${targetTitle}%`}`,
      ),
    )
    .limit(10);

  const seenPassageIds = new Set<string>();
  const sampledPassages: Array<{ id: string; title: string }> = [];
  for (const row of [...targetPassages, ...randomPassages]) {
    if (seenPassageIds.has(row.id)) {
      continue;
    }
    seenPassageIds.add(row.id);
    sampledPassages.push(row);
  }

  const sampledIds = sampledPassages.map((row) => row.id);
  if (sampledIds.length === 0) {
    console.log("No active passages found.");
    return;
  }

  const rows = await db
    .select({
      passageId: passages.id,
      title: passages.title,
      questionId: questions.id,
      sourceQuestionId: questions.sourceQuestionId,
      questionTypeIndex: questions.questionTypeIndex,
      questionPayloadJson: questions.questionPayloadJson,
      answerKeyId: answerKeys.id,
      answerType: answerKeys.answerType,
      answerValue: answerKeys.answerValue,
      acceptedValuesJson: answerKeys.acceptedValuesJson,
    })
    .from(passages)
    .innerJoin(questions, eq(questions.passageId, passages.id))
    .innerJoin(answerKeys, eq(answerKeys.questionId, questions.id))
    .where(inArray(passages.id, sampledIds));

  const anomalies: Anomaly[] = [];
  const updates = new Map<
    string,
    {
      answerValue: string;
      acceptedValuesJson: string[] | null;
      beforeAnswerValue: string;
      beforeAcceptedValuesJson: string[] | null;
    }
  >();

  for (const row of rows as AuditRow[]) {
    const expected = expectedAnswerType(row.questionTypeIndex);
    if (expected && row.answerType !== expected) {
      anomalies.push({
        passageId: row.passageId,
        title: row.title,
        questionId: row.questionId,
        sourceQuestionId: row.sourceQuestionId,
        kind: "ANSWER_TYPE_MISMATCH",
        before: row.answerType,
        after: expected,
      });
    }

    let normalizedAnswer = row.answerValue;
    if (row.questionTypeIndex === "tfng") {
      normalizedAnswer = canonicalizeTfngLabel(row.answerValue);
    } else if (row.questionTypeIndex === "mcq") {
      normalizedAnswer = canonicalizeOptionKey(row.answerValue);
    } else {
      normalizedAnswer = canonicalizeTextAnswer(row.answerValue);
    }

    if (normalizedAnswer !== row.answerValue) {
      anomalies.push({
        passageId: row.passageId,
        title: row.title,
        questionId: row.questionId,
        sourceQuestionId: row.sourceQuestionId,
        kind: "ANSWER_VALUE_NORMALIZED",
        before: row.answerValue,
        after: normalizedAnswer,
      });
    }

    if (row.questionTypeIndex === "mcq") {
      const optionKeys = parseMcqOptionKeys(row.questionPayloadJson);
      if (optionKeys.size > 0 && !optionKeys.has(normalizedAnswer)) {
        anomalies.push({
          passageId: row.passageId,
          title: row.title,
          questionId: row.questionId,
          sourceQuestionId: row.sourceQuestionId,
          kind: "MCQ_ANSWER_NOT_IN_OPTIONS",
          before: normalizedAnswer,
          note: `Options: ${[...optionKeys].join(", ")}`,
        });
      }
    }

    const normalizedAccepted = normalizeAcceptedValues(
      row.questionTypeIndex,
      row.acceptedValuesJson,
    );
    if (!equalStringArrays(normalizedAccepted, row.acceptedValuesJson)) {
      anomalies.push({
        passageId: row.passageId,
        title: row.title,
        questionId: row.questionId,
        sourceQuestionId: row.sourceQuestionId,
        kind: "ACCEPTED_VALUES_NORMALIZED",
        before: JSON.stringify(row.acceptedValuesJson ?? []),
        after: JSON.stringify(normalizedAccepted ?? []),
      });
    }

    if (
      normalizedAnswer !== row.answerValue ||
      !equalStringArrays(normalizedAccepted, row.acceptedValuesJson)
    ) {
      updates.set(row.answerKeyId, {
        answerValue: normalizedAnswer,
        acceptedValuesJson: normalizedAccepted,
        beforeAnswerValue: row.answerValue,
        beforeAcceptedValuesJson: row.acceptedValuesJson,
      });
    }
  }

  console.log(`Sampled passages: ${sampledPassages.length}`);
  console.log(`Checked Q/A rows: ${rows.length}`);
  console.log(`Anomalies found: ${anomalies.length}`);
  console.log(`Rows requiring update: ${updates.size}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  if (anomalies.length > 0) {
    console.log("---- Anomalies ----");
    for (const anomaly of anomalies) {
      const tail = anomaly.note ? ` (${anomaly.note})` : "";
      console.log(
        `[${anomaly.kind}] ${anomaly.passageId} | ${anomaly.title} | q${anomaly.sourceQuestionId} | ${anomaly.before}${anomaly.after ? ` -> ${anomaly.after}` : ""}${tail}`,
      );
    }
  }

  if (apply && updates.size > 0) {
    await db.transaction(async (tx) => {
      for (const [answerKeyId, updateValue] of updates.entries()) {
        await tx
          .update(answerKeys)
          .set({
            answerValue: updateValue.answerValue,
            acceptedValuesJson: updateValue.acceptedValuesJson,
            updatedAt: new Date(),
          })
          .where(eq(answerKeys.id, answerKeyId));
      }
    });
    console.log(`Applied updates to ${updates.size} answer_key rows.`);
  }
}

run()
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

