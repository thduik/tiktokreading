import type { PassageDetail } from "@/lib/passages-api";

// Cold backup passages exist only to avoid a blank startup screen when there is
// no recent hot backup yet. They are bundled with the app and intentionally
// lightweight, so the live feed can replace them as soon as the API responds.
export const COLD_BACKUP_PASSAGES: PassageDetail[] = [
  {
    id: "cold-backup-archivists",
    schema_version: "cold-backup-v1",
    exam_index: "backup",
    exam_label: "Offline Backup",
    band_index: 70,
    band_label: "7.0",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "resilience",
    topic_label: "Resilience",
    title: "Archive Teams and Flood Maps",
    factory_tag: "cold_backup",
    language_code: "en",
    status: "backup",
    passage:
      "City archive teams often begin flood planning with old neighborhood maps rather than new satellite imagery alone. The maps reveal where streams once crossed streets, which basements were repeatedly repaired, and which public buildings became informal shelters during earlier storms. Modern sensors still matter, but the older records help planners understand why some areas recover quickly while others remain vulnerable even after drainage systems are upgraded.",
    passage_meta: { sentence_count: 3, word_count: 70 },
    vocab: [],
    passage_sentences: [
      {
        sentence_index: 1,
        text: "City archive teams often begin flood planning with old neighborhood maps rather than new satellite imagery alone.",
      },
      {
        sentence_index: 2,
        text: "The maps reveal where streams once crossed streets, which basements were repeatedly repaired, and which public buildings became informal shelters during earlier storms.",
      },
      {
        sentence_index: 3,
        text: "Modern sensors still matter, but the older records help planners understand why some areas recover quickly while others remain vulnerable even after drainage systems are upgraded.",
      },
    ],
    questions: [],
    answer_key: [],
  },
  {
    id: "cold-backup-bazaars",
    schema_version: "cold-backup-v1",
    exam_index: "backup",
    exam_label: "Offline Backup",
    band_index: 75,
    band_label: "7.5",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "culture",
    topic_label: "Culture",
    title: "Market Shade and Walking Routes",
    factory_tag: "cold_backup",
    language_code: "en",
    status: "backup",
    passage:
      "In several hot-weather market districts, merchants do not think about shade only as comfort. Covered routes change how long people stay, which stalls they reach, and whether elderly visitors return later in the week. Small changes such as fabric canopies or shared awnings may therefore influence business patterns more strongly than a short-lived advertising campaign.",
    passage_meta: { sentence_count: 3, word_count: 57 },
    vocab: [],
    passage_sentences: [
      {
        sentence_index: 1,
        text: "In several hot-weather market districts, merchants do not think about shade only as comfort.",
      },
      {
        sentence_index: 2,
        text: "Covered routes change how long people stay, which stalls they reach, and whether elderly visitors return later in the week.",
      },
      {
        sentence_index: 3,
        text: "Small changes such as fabric canopies or shared awnings may therefore influence business patterns more strongly than a short-lived advertising campaign.",
      },
    ],
    questions: [],
    answer_key: [],
  },
  {
    id: "cold-backup-night-trains",
    schema_version: "cold-backup-v1",
    exam_index: "backup",
    exam_label: "Offline Backup",
    band_index: 80,
    band_label: "8.0+",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "transport",
    topic_label: "Transport",
    title: "Night Trains and Quiet Maintenance",
    factory_tag: "cold_backup",
    language_code: "en",
    status: "backup",
    passage:
      "Rail operators often schedule track repair during the night because passenger demand is lower, but the timing creates a second challenge: nearby residents may notice maintenance noise more sharply when general city traffic is absent. Some operators now divide repairs into shorter, quieter phases and publish neighborhood notices in advance. The change adds planning work, yet it reduces complaints and can preserve public support for long-term rail upgrades.",
    passage_meta: { sentence_count: 3, word_count: 69 },
    vocab: [],
    passage_sentences: [
      {
        sentence_index: 1,
        text: "Rail operators often schedule track repair during the night because passenger demand is lower, but the timing creates a second challenge: nearby residents may notice maintenance noise more sharply when general city traffic is absent.",
      },
      {
        sentence_index: 2,
        text: "Some operators now divide repairs into shorter, quieter phases and publish neighborhood notices in advance.",
      },
      {
        sentence_index: 3,
        text: "The change adds planning work, yet it reduces complaints and can preserve public support for long-term rail upgrades.",
      },
    ],
    questions: [],
    answer_key: [],
  },
  {
    id: "cold-backup-seed-libraries",
    schema_version: "cold-backup-v1",
    exam_index: "backup",
    exam_label: "Offline Backup",
    band_index: 60,
    band_label: "6.0",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "community",
    topic_label: "Community",
    title: "Seed Libraries in Small Towns",
    factory_tag: "cold_backup",
    language_code: "en",
    status: "backup",
    passage:
      "Small-town seed libraries usually begin with a narrow goal: helping local gardeners exchange familiar crops at low cost. Over time, however, some collections become records of regional growing knowledge. Notes about planting dates, soil conditions, and pest resistance accumulate beside the seeds themselves. The result is not only a supply system but also a practical archive shaped by repeated community use.",
    passage_meta: { sentence_count: 3, word_count: 61 },
    vocab: [],
    passage_sentences: [
      {
        sentence_index: 1,
        text: "Small-town seed libraries usually begin with a narrow goal: helping local gardeners exchange familiar crops at low cost.",
      },
      {
        sentence_index: 2,
        text: "Over time, however, some collections become records of regional growing knowledge.",
      },
      {
        sentence_index: 3,
        text: "Notes about planting dates, soil conditions, and pest resistance accumulate beside the seeds themselves. The result is not only a supply system but also a practical archive shaped by repeated community use.",
      },
    ],
    questions: [],
    answer_key: [],
  },
  {
    id: "cold-backup-lighthouses",
    schema_version: "cold-backup-v1",
    exam_index: "backup",
    exam_label: "Offline Backup",
    band_index: 75,
    band_label: "7.5",
    question_set_type_index: "mixed",
    question_set_type_label: "Mixed",
    topic_index: "history",
    topic_label: "History",
    title: "Lighthouse Logs and Weather Memory",
    factory_tag: "cold_backup",
    language_code: "en",
    status: "backup",
    passage:
      "Before automated instruments became widespread, lighthouse keepers wrote daily notes about wind direction, sea state, and unusual cloud behavior. Today, those logs attract researchers who compare them with modern climate records. The diaries are not perfectly uniform, but they sometimes preserve coastal observations from places where long, continuous scientific measurement arrived much later.",
    passage_meta: { sentence_count: 3, word_count: 55 },
    vocab: [],
    passage_sentences: [
      {
        sentence_index: 1,
        text: "Before automated instruments became widespread, lighthouse keepers wrote daily notes about wind direction, sea state, and unusual cloud behavior.",
      },
      {
        sentence_index: 2,
        text: "Today, those logs attract researchers who compare them with modern climate records.",
      },
      {
        sentence_index: 3,
        text: "The diaries are not perfectly uniform, but they sometimes preserve coastal observations from places where long, continuous scientific measurement arrived much later.",
      },
    ],
    questions: [],
    answer_key: [],
  },
];

export function selectColdBackupPassage(factoryTagFilter: string | null) {
  const seed = `${factoryTagFilter ?? "all"}:${COLD_BACKUP_PASSAGES.length}`;
  const hash = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLD_BACKUP_PASSAGES[hash % COLD_BACKUP_PASSAGES.length]!;
}
