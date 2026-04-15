#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
OUT_DIR="$ROOT_DIR/_bmad-output/implementation-artifacts/benchmarks"
OUT_FILE="$OUT_DIR/e2e-parallel-benchmark-${STAMP//:/-}.md"

mkdir -p "$OUT_DIR"

BASE_CMD=(npx playwright test --workers=1 --reporter=line)
NEW_CMD=(npx playwright test --reporter=line)

echo "Running baseline (workers=1)..."
START_BASE=$(date +%s)
if ! "${BASE_CMD[@]}" > /tmp/e2e-benchmark-baseline.log 2>&1; then
  echo "Baseline run failed. See /tmp/e2e-benchmark-baseline.log"
  exit 1
fi
END_BASE=$(date +%s)

echo "Running parallel (config workers)..."
START_NEW=$(date +%s)
if ! "${NEW_CMD[@]}" > /tmp/e2e-benchmark-parallel.log 2>&1; then
  echo "Parallel run failed. See /tmp/e2e-benchmark-parallel.log"
  exit 1
fi
END_NEW=$(date +%s)

BASE_SECONDS=$((END_BASE - START_BASE))
NEW_SECONDS=$((END_NEW - START_NEW))

if [ "$BASE_SECONDS" -eq 0 ]; then
  echo "Baseline duration is 0s, cannot compute speedup."
  exit 1
fi

SPEEDUP_PERCENT=$(( ( (BASE_SECONDS - NEW_SECONDS) * 100 ) / BASE_SECONDS ))

cat > "$OUT_FILE" <<EOF
# E2E Parallel Benchmark

- Date (UTC): $STAMP
- Baseline command: \
  \
  \\`npx playwright test --workers=1 --reporter=line\\`
- Parallel command: \
  \
  \\`npx playwright test --reporter=line\\`

## Results

- Baseline duration: ${BASE_SECONDS}s
- Parallel duration: ${NEW_SECONDS}s
- Speedup: ${SPEEDUP_PERCENT}%

## Logs

- Baseline log: \
  \
  \\`/tmp/e2e-benchmark-baseline.log\\`
- Parallel log: \
  \
  \\`/tmp/e2e-benchmark-parallel.log\\`
EOF

echo "Benchmark report written to: $OUT_FILE"
echo "Speedup: ${SPEEDUP_PERCENT}%"

if [ "$SPEEDUP_PERCENT" -lt 50 ]; then
  echo "Expected at least 50% speedup, got ${SPEEDUP_PERCENT}%"
  exit 2
fi
