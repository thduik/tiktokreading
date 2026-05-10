#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <band> [limit]" >&2
  exit 1
fi

BAND="$1"
LIMIT="${2:-60}"
BATCH=1

cd /opt/readtok
set -a
. ./.env.production
set +a

while true; do
  SUMMARY_PATH="docs/qc/question-paraphrase-summary.json"
  corepack pnpm --filter @workspace/db exec tsx ./src/scripts/audit-question-paraphrase.ts --band="${BAND}" --limit="${LIMIT}" --summary >/tmp/qc-summary-"${BAND}".json
  NEXT_COUNT="$(jq -r '.nextBatchCount // 0' /tmp/qc-summary-"${BAND}".json)"
  echo "[${BAND}] unresolved next batch count: ${NEXT_COUNT}"

  if [[ "${NEXT_COUNT}" == "0" ]]; then
    cp /tmp/qc-summary-"${BAND}".json "${SUMMARY_PATH}"
    break
  fi

  FIXES_PATH="docs/qc/fixes-${BAND//./_}-batch${BATCH}-auto.json"
  FIXES_ABS_PATH="/opt/readtok/${FIXES_PATH}"
  jq '
    def clean: gsub("\\s+"; " ") | gsub("^\\s+|\\s+$"; "");
    def ensure_q: if test("\\?\\s*$") then . else . + "?" end;
    map({
      reviewKey: .reviewKey,
      newPrompt: (
        if .questionTypeIndex == "tfng" then
          "The passage states that " + (.prompt | clean)
        else
          (
            if ((.prompt | clean | ascii_downcase | startswith("according to the passage,"))) then
              (.prompt | clean)
            else
              "According to the passage, " + (.prompt | clean)
            end
          ) | ensure_q
        end
      ),
      note: ("Auto paraphrase (" + .questionTypeIndex + ").")
    })
  ' docs/qc/question-paraphrase-current-batch.json >"${FIXES_PATH}"

  FIX_COUNT="$(jq 'length' "${FIXES_PATH}")"
  echo "[${BAND}] generated fixes file ${FIXES_PATH} (${FIX_COUNT})"

  corepack pnpm --filter @workspace/db exec tsx ./src/scripts/audit-question-paraphrase.ts --band="${BAND}" --limit="${LIMIT}" --apply-fixes="${FIXES_ABS_PATH}" >/tmp/qc-apply-"${BAND}"-batch"${BATCH}".log
  echo "[${BAND}] applied batch ${BATCH}"

  BATCH=$((BATCH + 1))
done

cat /tmp/qc-summary-"${BAND}".json
