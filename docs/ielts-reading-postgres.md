# IELTS Reading PostgreSQL Foundation

## Inferred Content Model (from `reading-material-db.v2.json`)

Each card/passage contains:

- Card metadata (`schema_version`, exam/band/topic, `question_set_type_index`, `status`, `language_code`)
- Passage text + `passage_meta` (`sentence_count`, `word_count`)
- Passage vocab (`vocab[]`) with `term`, `definition`, optional `meaning_vi`, optional `sentence_index`
- Ordered questions (`order_index`, type, prompt, payload)
- Answer key entries (`question_id`, `answer_type`, `answer_value`, optional `accepted_values`, `explanation`)

Supported question types:

- `tfng`
- `mcq`
- `sentence_completion`
- `short_answer`

Card-level rule:

- `question_set_type_index` is either one type (`tfng`, `mcq`, `sentence_completion`, `short_answer`) or `mixed`.
- `mixed` must include all four distinct question types.
- non-`mixed` cards must contain only that one question type.

## Schema Rationale

Three lean core tables were implemented:

1. `passages`
2. `questions`
3. `answer_keys`

Why this shape:

- Keeps filtering metadata in one table (`passages`) for fast list queries.
- Keeps question rendering uniform with one base `questions` table.
- Uses `question_payload_json` (`JSONB`) for type-specific details (`options`, `max_words`, `instruction_label`, `case_sensitive`) without over-normalizing.
- Keeps answer rules flexible with `answer_type`, `answer_value`, `accepted_values_json`.
- Stores tappable vocab per passage in `passages.vocab_json` for consistent frontend rendering and future export.

Key constraints and validation:

- `CHECK` constraints for allowed `question_set_type_index`, `question_type_index`, `answer_type`.
- DB triggers enforce:
  - mixed cards contain all 4 question types
  - single-type cards match card-level type exactly
  - `answer_type` matches question type (`label`, `option_key`, `text`)

## Migration and Import

Migration file:

- `lib/db/migrations/0001_ielts_reading_core.sql`
- `lib/db/migrations/0004_passages_vocab_json.sql`

Scripts:

- `pnpm --filter @workspace/db run migrate`
- `pnpm --filter @workspace/db run import:sample`
- `pnpm --filter @workspace/db run backfill:vocab` (adds/normalizes `vocab[]` in the v2 JSON datasets)

Importer source default:

- `artifacts/readtok/src/lib/reading-material-db.v2.json`

Optional custom input:

- `pnpm --filter @workspace/db run import:sample -- ./path/to/cards.json`

## API Retrieval Shape

### List: `GET /api/passages`

Filters supported:

- `band_index`
- `question_set_type_index`
- `topic_index`
- `status`
- `language_code`
- `ids` (comma-separated)

Response item shape:

```json
{
  "id": "ielts_reading_75_mixed_0005",
  "band_index": 75,
  "band_label": "7.5",
  "question_set_type_index": "mixed",
  "question_set_type_label": "Mixed",
  "topic_index": "environment/water_pricing_conservation",
  "topic_label": "Water Pricing and Conservation",
  "title": "Water Pricing and Conservation",
  "status": "active",
  "question_count": 4
}
```

### Detail: `GET /api/passages/:id`

Response shape (uniform for single-type and mixed):

```json
{
  "id": "ielts_reading_75_mixed_0005",
  "schema_version": "2.1",
  "question_set_type_index": "mixed",
  "title": "Water Pricing and Conservation",
  "passage": "...",
  "passage_meta": {
    "sentence_count": 4,
    "word_count": 58
  },
  "vocab": [
    {
      "term": "pricing",
      "definition": "Higher rates for excessive use are intended to reduce waste.",
      "meaning_vi": "định giá",
      "sentence_index": 2
    }
  ],
  "questions": [
    {
      "id": 1,
      "order_index": 1,
      "question_type_index": "tfng",
      "question_type_label": "True / False / Not Given",
      "prompt": "...",
      "payload": {}
    }
  ],
  "answer_key": [
    {
      "question_id": 1,
      "answer_type": "label",
      "answer_value": "TRUE",
      "explanation": "..."
    }
  ]
}
```

## Mobile-First UI Structure

Implemented in `@workspace/readtok`:

- Feed/Library page:
  - header
  - horizontal pill filters (band/type/topic)
  - vertical passage cards
  - no search bar
  - no sidebar
- Passage detail/practice page:
  - metadata pills
  - optional audio button
  - large title + readable passage block
  - inline question flow with type badges
  - TFNG / MCQ / text answer controls
  - floating Save / Share buttons
  - submit -> review mode
- Review mode:
  - user answer
  - correct answer
  - explanation
  - clear correct/incorrect indicator
- Bottom nav:
  - Feed
  - Saved
  - Profile

## Example SQL Queries

List active Band 7.5 mixed cards:

```sql
SELECT id, title, topic_label
FROM passages
WHERE status = 'active'
  AND band_index = 75
  AND question_set_type_index = 'mixed'
ORDER BY title;
```

Get one passage + ordered questions + answer key:

```sql
SELECT
  p.id,
  p.title,
  q.order_index,
  q.question_type_index,
  q.prompt,
  q.question_payload_json,
  a.answer_type,
  a.answer_value,
  a.accepted_values_json,
  a.explanation
FROM passages p
JOIN questions q ON q.passage_id = p.id
LEFT JOIN answer_keys a ON a.question_id = q.id
WHERE p.id = 'ielts_reading_75_mixed_0005'
ORDER BY q.order_index;
```
