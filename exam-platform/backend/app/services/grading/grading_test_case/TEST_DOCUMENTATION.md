# Grading Test Suite Documentation

All test files live in `app/services/grading/grading_test_case/`.

---

## Files

| File | Purpose | Requires API key |
|---|---|---|
| `test_deterministic.py` | Unit tests for rule-based grading functions | No |
| `test_deepeval_grading.py` | LLM grading quality tests via deepeval | Yes (`OPENROUTER_API_KEY`) |
| `deepeval_metrics.py` | Custom deepeval metrics (`ScoreRangeMetric`, `CriterionConsistencyMetric`) | — |
| `grading_test_dataset.py` | `GradingTestCase` dataclass + 10 test cases across all question types | — |

---

## Running the Tests

### Deterministic tests (no API key needed)

```bash
cd exam-platform/backend
python -m pytest "app/services/grading/grading_test_case/test_deterministic.py" -v
```

Expected: 30 passed.

### DeepEval LLM quality tests

```bash
cd exam-platform/backend
python -m pytest "app/services/grading/grading_test_case/test_deepeval_grading.py" -v
```

Requires `OPENROUTER_API_KEY` to be set. Skips automatically if not set.

**Fast mode** (4 API calls — one per question type):

```cmd
set DEEPEVAL_FAST=1 & python -m pytest "app/services/grading/grading_test_case/test_deepeval_grading.py" -v
```

**Run only specific cases** (to avoid re-running passing tests):

```cmd
python -m pytest "app/services/grading/grading_test_case/test_deepeval_grading.py" -v -k "sa-trace-correct or essay-planning-fallacy-high"
```

**Enable optional GEval rationale quality metric** (costs extra API calls):

```cmd
set DEEPEVAL_ENABLE_GEVAL=1 & python -m pytest "app/services/grading/grading_test_case/test_deepeval_grading.py" -v
```

---

## test_deterministic.py — 30 tests

**Module under test:** `app/services/grading/grading_agents/deterministic.py`
No LLM calls, no database, no running server required.

### TestGradeMcq (10 tests)

Tests `grade_mcq()` — scores multiple-choice questions by comparing selected option(s) against correct option IDs.

| Test | Description |
|---|---|
| `test_single_correct` | Correct single-choice answer receives full marks, `confidence=1.0`, `DETERMINISTIC` lane |
| `test_single_wrong` | Incorrect answer receives zero marks |
| `test_single_empty_answer` | Empty answer receives zero marks |
| `test_multiple_all_correct` | All correct options selected receives full marks |
| `test_multiple_partial_credit` | One correct + one wrong receives partial credit |
| `test_multiple_all_wrong` | Only wrong options receives zero marks |
| `test_score_never_negative` | Many wrong options never produces a negative score |
| `test_no_correct_options_full_score` | No correct options defined → full marks (edge case guard) |
| `test_rationale_contains_selected_and_correct` | Rationale includes both student selection and correct answer |
| `test_criterion_results_populated` | Result contains at least one `CriterionGradeResult` with correct score |

### TestGradeExactMatch (9 tests)

Tests `grade_exact_match()` — scores short-answer questions against a list of acceptable answers. Returns `None` on a miss to trigger LLM escalation.

| Test | Description |
|---|---|
| `test_exact_hit` | Matching answer receives full marks, `normalized_score=1.0` |
| `test_case_insensitive_hit` | Matching is case-insensitive by default |
| `test_whitespace_trimmed` | Leading/trailing whitespace is ignored |
| `test_miss_returns_none` | Non-matching answer returns `None` |
| `test_multiple_acceptable_answers` | Any answer in the list triggers full marks |
| `test_empty_student_answer_miss` | Empty answer returns `None` |
| `test_evidence_span_populated` | Matched result includes an `EvidenceSpan` quoting the answer |
| `test_case_sensitive_mode` | `case_sensitive=True` causes case differences to miss |
| `test_deterministic_lane` | All matched results tagged with `DETERMINISTIC` lane |

### TestGradeNumericMatch (11 tests)

Tests `grade_numeric_match()` — scores mathematics answers by parsing the student's text as a number and comparing within a tolerance. Returns `None` on miss or unparseable input.

| Test | Description |
|---|---|
| `test_integer_match` | Integer answer matching expected value receives full marks |
| `test_float_match` | Decimal answer matching expected value receives full marks |
| `test_trailing_period_stripped` | `"42."` is normalised before comparison |
| `test_miss_returns_none` | Wrong number returns `None` |
| `test_non_numeric_returns_none` | Text answer returns `None` |
| `test_empty_answer_returns_none` | Empty answer returns `None` |
| `test_tolerance_within` | Value within tolerance threshold is accepted |
| `test_tolerance_exceeded` | Value outside tolerance threshold is rejected |
| `test_multiple_expected_values` | Matching any value in the expected list triggers correct result |
| `test_deterministic_lane` | All matched results tagged with `DETERMINISTIC` lane |

---

## test_deepeval_grading.py — 10 tests

**Modules under test:** `short_answer.py`, `long_answer.py`, `coding.py`, `mathematics.py`
Requires `OPENROUTER_API_KEY`. Each test makes one LLM API call.

### Test Cases

| Test ID | Question Type | Scenario | Expected Score Range |
|---|---|---|---|
| `sa-trace-correct` | short_answer | Correct trace table | 0.8 – 1.0 |
| `sa-trace-wrong` | short_answer | Completely wrong trace | 0.0 – 0.2 |
| `sa-trace-partial` | short_answer | Partially correct trace | 0.2 – 0.8 |
| `essay-planning-fallacy-high` | essay | High quality essay | 0.7 – 1.0 |
| `essay-planning-fallacy-low` | essay | Low quality essay | 0.0 – 0.3 |
| `coding-is-divisible-correct` | coding | Correct implementation | 0.8 – 1.0 |
| `coding-rotate-incorrect` | coding | Wrong implementation | 0.0 – 0.4 |
| `math-rectangle-correct-numeric` | mathematics | Correct numeric answers | 0.7 – 1.0 |
| `math-rectangle-wrong-numeric` | mathematics | Wrong numeric answers | 0.0 – 0.2 |
| `math-rectangle-correct-reasoning` | mathematics | Correct with full working | 0.7 – 1.0 |

### Metrics

- **ScoreRangeMetric** — asserts `normalized_score` falls within `[min_expected, max_expected]` (always on)
- **CriterionConsistencyMetric** — asserts sum of criterion scores is within 0.5 of `raw_score` (always on)
- **GEval Rationale Quality** — asserts rationale references student answer and rubric (opt-in via `DEEPEVAL_ENABLE_GEVAL=1`)

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required. Tests skip if not set. |
| `DEEPEVAL_FAST` | `0` | Set to `1` to run only 4 cases (one per question type) |
| `DEEPEVAL_ENABLE_GEVAL` | `0` | Set to `1` to enable GEval rationale metric |
| `GRADING_MATH_MODEL` | `deepseek/deepseek-v3.2` | Overridden in tests away from `kimi-k2.5` which returns empty content |
