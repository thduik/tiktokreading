import { writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { answerKeys, db, pool, questions } from "../index";

type OptionItem = {
  key: string;
  text: string;
};

type McqPayload = Record<string, unknown> & {
  options?: unknown;
};

type McqRow = {
  questionId: string;
  questionPayloadJson: Record<string, unknown>;
  answerKeyId: string;
  answerValue: string;
};

type UpdatePlan = {
  questionId: string;
  answerKeyId: string;
  oldAnswerValue: string;
  newAnswerValue: string;
  oldPayload: Record<string, unknown>;
  newPayload: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOption(value: unknown): OptionItem | null {
  if (!isObject(value)) {
    return null;
  }

  const key = value.key;
  const text = value.text;
  if (typeof key !== "string" || typeof text !== "string") {
    return null;
  }

  const normalizedKey = key.trim();
  const normalizedText = text.trim();
  if (normalizedKey.length === 0 || normalizedText.length === 0) {
    return null;
  }

  return { key: normalizedKey, text: normalizedText };
}

function toOptionLetter(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}

function buildUpdatePlan(row: McqRow): UpdatePlan {
  const payload = row.questionPayloadJson as McqPayload;
  const optionRawList = payload.options;
  if (!Array.isArray(optionRawList) || optionRawList.length < 2) {
    throw new Error(
      `Question ${row.questionId} has invalid options payload (needs at least 2 options).`,
    );
  }

  const parsedOptions: OptionItem[] = [];
  for (const rawOption of optionRawList) {
    const parsed = parseOption(rawOption);
    if (!parsed) {
      throw new Error(`Question ${row.questionId} has malformed option data.`);
    }
    parsedOptions.push(parsed);
  }

  const currentAnswer = row.answerValue.trim().toUpperCase();
  const currentCorrectOption = parsedOptions.find(
    (option) => option.key.trim().toUpperCase() === currentAnswer,
  );
  if (!currentCorrectOption) {
    throw new Error(
      `Question ${row.questionId} points to answer key ${row.answerValue}, but no matching option key exists.`,
    );
  }

  const tagged = parsedOptions.map((option, index) => ({
    ...option,
    __tag: `${index}:${option.key}:${option.text}`,
  }));
  const shuffled = shuffle(tagged).map((option, index) => ({
    key: toOptionLetter(index),
    text: option.text,
    __tag: option.__tag,
  }));

  const correctTag = tagged.find(
    (option) =>
      option.key === currentCorrectOption.key &&
      option.text === currentCorrectOption.text,
  )?.__tag;
  if (!correctTag) {
    throw new Error(
      `Question ${row.questionId} failed to resolve current correct option identity.`,
    );
  }

  const newCorrectOption = shuffled.find((option) => option.__tag === correctTag);
  if (!newCorrectOption) {
    throw new Error(
      `Question ${row.questionId} failed to map correct option after shuffle.`,
    );
  }

  const newPayload: Record<string, unknown> = {
    ...payload,
    options: shuffled.map(({ key, text }) => ({ key, text })),
  };

  return {
    questionId: row.questionId,
    answerKeyId: row.answerKeyId,
    oldAnswerValue: row.answerValue,
    newAnswerValue: newCorrectOption.key,
    oldPayload: row.questionPayloadJson,
    newPayload,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({
      questionId: questions.id,
      questionPayloadJson: questions.questionPayloadJson,
      answerKeyId: answerKeys.id,
      answerValue: answerKeys.answerValue,
    })
    .from(questions)
    .innerJoin(answerKeys, eq(answerKeys.questionId, questions.id))
    .where(eq(questions.questionTypeIndex, "mcq"));

  const mcqRows = rows.filter((row) => row.questionPayloadJson && row.answerValue);
  if (mcqRows.length === 0) {
    console.log("No MCQ rows found. Nothing to do.");
    return;
  }

  const plans = mcqRows.map((row) =>
    buildUpdatePlan({
      questionId: row.questionId,
      questionPayloadJson: row.questionPayloadJson,
      answerKeyId: row.answerKeyId,
      answerValue: row.answerValue,
    }),
  );

  const changedPlans = plans.filter((plan) => plan.oldAnswerValue !== plan.newAnswerValue);
  console.log(`MCQ rows scanned: ${plans.length}`);
  console.log(`Rows with changed correct key: ${changedPlans.length}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  if (!apply) {
    for (const preview of plans.slice(0, 5)) {
      console.log(
        `Preview ${preview.questionId}: ${preview.oldAnswerValue} -> ${preview.newAnswerValue}`,
      );
    }
    console.log("Run with --apply to persist updates.");
    return;
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = path.join(
    "/tmp",
    `mcq-scramble-backup-${timestamp}.json`,
  );
  await writeFile(
    backupPath,
    JSON.stringify(
      plans.map((plan) => ({
        question_id: plan.questionId,
        answer_key_id: plan.answerKeyId,
        answer_value_before: plan.oldAnswerValue,
        payload_before: plan.oldPayload,
      })),
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Backup written: ${backupPath}`);

  await db.transaction(async (trx) => {
    for (const plan of plans) {
      await trx
        .update(questions)
        .set({
          questionPayloadJson: plan.newPayload,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, plan.questionId));

      await trx
        .update(answerKeys)
        .set({
          answerValue: plan.newAnswerValue,
          updatedAt: new Date(),
        })
        .where(eq(answerKeys.id, plan.answerKeyId));
    }
  });

  console.log(`Applied updates for ${plans.length} MCQ rows.`);
}

main()
  .catch((error) => {
    console.error("Failed to scramble MCQ answers:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
