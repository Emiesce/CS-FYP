"""
Grading Test Dataset

Defines GradingTestCase dataclass and GRADING_TEST_CASES list used by the
deepeval grading test suite. Test cases cover all question types with
correct, wrong, and partial answer scenarios.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.grading_models import RubricCriterion, RubricScoreBand, StructuredRubric


@dataclass
class GradingTestCase:
    id: str
    question_type: str          # "short_answer" | "essay" | "coding" | "mathematics"
    question_prompt: str
    student_answer: str
    rubric: StructuredRubric
    max_points: float
    min_expected_score: float   # normalized 0.0–1.0
    max_expected_score: float   # normalized 0.0–1.0
    language: str | None = None  # for coding questions


# ---------------------------------------------------------------------------
# SHORT ANSWER
# ---------------------------------------------------------------------------

_SA_TRACE_PROMPT = """\
Analyze the following function:

```python
def branch_and_loop(nums: list[int | None]) -> int:
    total: int = 1
    for value in nums:
        if value is None:
            total += 2
            continue
        if value % 3 == 0:
            total *= value
        elif value % 2 == 0:
            total += value
            break
        else:
            total -= value
    return total
```

Given the list `data = [1, None, 3, 1, -7, -4, 5]`, call `branch_and_loop(data)` and \
provide the value of `total` after processing each element. If an element is not processed \
(loop has exited), write `/`.

Format your answer as 7 values separated by ` | ` for elements: 1, None, 3, 1, -7, -4, 5"""

_SA_TRACE_RUBRIC = StructuredRubric(
    question_id="sa-trace-correct",
    criteria=[
        RubricCriterion(
            id="trace_values",
            label="Trace Table Values",
            description="1 point per correct value. Expected: 0 | 2 | 6 | 5 | 12 | 8 | /",
            max_points=7.0,
        )
    ],
    total_points=7.0,
)

# ---------------------------------------------------------------------------
# ESSAY
# ---------------------------------------------------------------------------

_ESSAY_PROMPT = (
    "Explain the psychology factor of planning fallacy. Discuss the "
    "Inside-Outside Model, relevant biases and attribution, motivated "
    "reasoning, and support your explanation with examples or evidence."
)

_ESSAY_RUBRIC = StructuredRubric(
    question_id="essay-planning-fallacy",
    criteria=[
        RubricCriterion(
            id="inside_outside_model",
            label="Inside-Outside Model",
            description="Accurately explains the inside view (personal optimism) vs outside view (base rates).",
            max_points=5.0,
            score_bands=[
                RubricScoreBand(label="Excellent", min_points=4.0, max_points=5.0, description="Clear, accurate explanation with examples."),
                RubricScoreBand(label="Adequate", min_points=2.0, max_points=3.9, description="Partial explanation, missing one aspect."),
                RubricScoreBand(label="Poor", min_points=0.0, max_points=1.9, description="Vague or incorrect."),
            ],
        ),
        RubricCriterion(
            id="biases_attribution",
            label="Biases and Attribution",
            description="Identifies optimism bias, self-serving attribution, and related cognitive biases.",
            max_points=5.0,
            score_bands=[
                RubricScoreBand(label="Excellent", min_points=4.0, max_points=5.0, description="Names and explains multiple biases with attribution."),
                RubricScoreBand(label="Adequate", min_points=2.0, max_points=3.9, description="Mentions biases but lacks depth."),
                RubricScoreBand(label="Poor", min_points=0.0, max_points=1.9, description="Missing or incorrect."),
            ],
        ),
        RubricCriterion(
            id="motivated_reasoning",
            label="Motivated Reasoning",
            description="Explains how motivated reasoning reinforces planning fallacy.",
            max_points=5.0,
        ),
        RubricCriterion(
            id="evidence_examples",
            label="Evidence and Examples",
            description="Supports claims with real-world examples or empirical evidence.",
            max_points=5.0,
        ),
    ],
    total_points=20.0,
)

_ESSAY_HIGH_QUALITY = """\
The planning fallacy is a cognitive bias where individuals underestimate the time, costs, \
and risks of future actions while overestimating the benefits. Kahneman and Tversky's \
Inside-Outside Model explains this through two perspectives: the inside view, where planners \
focus on the specific details of their own project and ignore base rates, and the outside view, \
which uses historical data from similar projects to form realistic estimates.

Key biases include optimism bias — the tendency to believe one is less likely to experience \
negative events — and self-serving attribution, where successes are attributed to skill and \
failures to external factors. Motivated reasoning further compounds this: people unconsciously \
seek information that confirms their optimistic projections and dismiss contradictory evidence.

Empirical support comes from Buehler et al. (1994), who showed that students consistently \
underestimated completion times for assignments even when asked to consider past performance. \
Similarly, large infrastructure projects like the Sydney Opera House (budgeted at $7M, \
completed at $102M) illustrate how the inside view dominates planning decisions at scale.\
"""

_ESSAY_LOW_QUALITY = """\
Planning fallacy means people don't plan well. They think things will be faster than they are. \
This happens because people are optimistic. The inside model says you look at your own plan. \
Sometimes people make mistakes in their reasoning. There are many biases in psychology. \
Examples include when students are late with assignments.\
"""

# ---------------------------------------------------------------------------
# CODING
# ---------------------------------------------------------------------------

_CODING_IS_DIVISIBLE_PROMPT = """\
Implement a Python function `is_divisible(n, k)` that checks whether `n` is divisible by `k`. \
Both `n` and `k` are positive integers. You can assume `n` is always larger than `k`.

Examples:
- `is_divisible(10, 5)` → `True`
- `is_divisible(10, 3)` → `False`"""

_CODING_IS_DIVISIBLE_RUBRIC = StructuredRubric(
    question_id="coding-is-divisible",
    criteria=[
        RubricCriterion(id="modulus", label="Uses modulus operator (%)", description="Uses % to check divisibility.", max_points=0.5),
        RubricCriterion(id="return_bool", label="Returns boolean correctly", description="Returns True/False correctly.", max_points=0.5),
    ],
    total_points=1.0,
)

_CODING_ROTATE_PROMPT = """\
Implement a function `rotate_clockwise(lst)` that takes a square 2D list (n×n) and returns \
a new 2D list rotated 90 degrees clockwise. You must use a new 2D list to store the output.

Example:
- Input: `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]`
- Output: `[[7, 4, 1], [8, 5, 2], [9, 6, 3]]`"""

_CODING_ROTATE_RUBRIC = StructuredRubric(
    question_id="coding-rotate-clockwise",
    criteria=[
        RubricCriterion(id="len", label="Gets n=len(lst)", description="Correctly gets matrix dimension.", max_points=0.5),
        RubricCriterion(id="init_2d", label="Initializes new n×n list", description="Creates a new 2D list of correct size.", max_points=2.0),
        RubricCriterion(id="loops", label="Two loops 0 to n", description="Uses nested loops over the matrix.", max_points=1.5),
        RubricCriterion(id="index", label="Correct index mapping", description="Maps rotated[j][n-1-i] = lst[i][j] correctly.", max_points=2.0),
        RubricCriterion(id="return", label="Returns rotated list", description="Returns the new rotated list.", max_points=1.0),
    ],
    total_points=7.0,
)

# ---------------------------------------------------------------------------
# MATHEMATICS
# ---------------------------------------------------------------------------

_MATH_PROMPT = """\
A rectangle has a length of 12 cm and a width of 5 cm.

(a) Calculate the area of the rectangle.
(b) Calculate the perimeter of the rectangle.
(c) If the length is doubled and the width is halved, explain whether the area changes and by how much."""

_MATH_RUBRIC = StructuredRubric(
    question_id="math-rectangle",
    criteria=[
        RubricCriterion(
            id="area",
            label="Area Calculation",
            description="Area = length × width = 12 × 5 = 60 cm²",
            max_points=2.0,
        ),
        RubricCriterion(
            id="perimeter",
            label="Perimeter Calculation",
            description="Perimeter = 2(length + width) = 2(12 + 5) = 34 cm",
            max_points=2.0,
        ),
        RubricCriterion(
            id="reasoning",
            label="Reasoning about dimension change",
            description="New area = 24 × 2.5 = 60 cm². Area remains the same because doubling one dimension and halving the other keeps the product constant.",
            max_points=3.0,
        ),
    ],
    total_points=7.0,
)

# ---------------------------------------------------------------------------
# GRADING_TEST_CASES – 10 cases total
# ---------------------------------------------------------------------------

GRADING_TEST_CASES: list[GradingTestCase] = [
    GradingTestCase(
        id="sa-trace-correct",
        question_type="short_answer",
        question_prompt=_SA_TRACE_PROMPT,
        student_answer="0 | 2 | 6 | 5 | 12 | 8 | /",
        rubric=_SA_TRACE_RUBRIC,
        max_points=7.0,
        min_expected_score=0.8,
        max_expected_score=1.0,
    ),
    GradingTestCase(
        id="sa-trace-wrong",
        question_type="short_answer",
        question_prompt=_SA_TRACE_PROMPT,
        student_answer="1 | 3 | 9 | 8 | 1 | 5 | 10",
        rubric=_SA_TRACE_RUBRIC,
        max_points=7.0,
        min_expected_score=0.0,
        max_expected_score=0.2,
    ),
    GradingTestCase(
        id="sa-trace-partial",
        question_type="short_answer",
        question_prompt=_SA_TRACE_PROMPT,
        student_answer="0 | 2 | 6 | 5 | 12 | 10 | 15",
        rubric=_SA_TRACE_RUBRIC,
        max_points=7.0,
        min_expected_score=0.2,
        max_expected_score=0.8,
    ),
    GradingTestCase(
        id="essay-planning-fallacy-high",
        question_type="essay",
        question_prompt=_ESSAY_PROMPT,
        student_answer=_ESSAY_HIGH_QUALITY,
        rubric=_ESSAY_RUBRIC,
        max_points=20.0,
        min_expected_score=0.7,
        max_expected_score=1.0,
    ),
    GradingTestCase(
        id="essay-planning-fallacy-low",
        question_type="essay",
        question_prompt=_ESSAY_PROMPT,
        student_answer=_ESSAY_LOW_QUALITY,
        rubric=_ESSAY_RUBRIC,
        max_points=20.0,
        min_expected_score=0.0,
        max_expected_score=0.3,
    ),
    GradingTestCase(
        id="coding-is-divisible-correct",
        question_type="coding",
        question_prompt=_CODING_IS_DIVISIBLE_PROMPT,
        student_answer="def is_divisible(n, k):\n    return n % k == 0",
        rubric=_CODING_IS_DIVISIBLE_RUBRIC,
        max_points=1.0,
        min_expected_score=0.8,
        max_expected_score=1.0,
        language="python",
    ),
    GradingTestCase(
        id="coding-rotate-incorrect",
        question_type="coding",
        question_prompt=_CODING_ROTATE_PROMPT,
        student_answer=(
            "def rotate_clockwise(lst):\n"
            "    # just return the original list unchanged\n"
            "    return lst"
        ),
        rubric=_CODING_ROTATE_RUBRIC,
        max_points=7.0,
        min_expected_score=0.0,
        max_expected_score=0.4,
        language="python",
    ),
    GradingTestCase(
        id="math-rectangle-correct-numeric",
        question_type="mathematics",
        question_prompt=_MATH_PROMPT,
        student_answer="(a) Area = 60 cm²\n(b) Perimeter = 34 cm\n(c) The area stays the same at 60 cm².",
        rubric=_MATH_RUBRIC,
        max_points=7.0,
        min_expected_score=0.7,
        max_expected_score=1.0,
    ),
    GradingTestCase(
        id="math-rectangle-wrong-numeric",
        question_type="mathematics",
        question_prompt=_MATH_PROMPT,
        student_answer="(a) Area = 17 cm²\n(b) Perimeter = 60 cm\n(c) The area doubles.",
        rubric=_MATH_RUBRIC,
        max_points=7.0,
        min_expected_score=0.0,
        max_expected_score=0.2,
    ),
    GradingTestCase(
        id="math-rectangle-correct-reasoning",
        question_type="mathematics",
        question_prompt=_MATH_PROMPT,
        student_answer=(
            "(a) Area = length × width = 12 × 5 = 60 cm²\n"
            "(b) Perimeter = 2 × (12 + 5) = 2 × 17 = 34 cm\n"
            "(c) New length = 24 cm, new width = 2.5 cm. "
            "New area = 24 × 2.5 = 60 cm². The area does not change because "
            "multiplying one dimension by 2 and dividing the other by 2 leaves "
            "the product unchanged."
        ),
        rubric=_MATH_RUBRIC,
        max_points=7.0,
        min_expected_score=0.7,
        max_expected_score=1.0,
    ),
]
