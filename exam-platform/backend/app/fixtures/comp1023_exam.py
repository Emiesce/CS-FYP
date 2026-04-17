"""
COMP1023 Midterm Exam – Fixture Data

All questions, correct answers, and rubrics for the COMP1023 midterm.
Used by the test-grading sandbox endpoint.
"""

from __future__ import annotations

from app.models.exam_models import (
    CodingQuestionData,
    ExamDefinitionOut,
    ExamQuestionIn,
    McqOption,
    McqQuestionData,
    QuestionRubric,
    ShortAnswerQuestionData,
)
from app.models.grading_models import (
    RubricCriterion,
    RubricScoreBand,
    StructuredRubric,
)
from datetime import datetime

# ---- Question IDs (stable) ------------------------------------------

Q1A = "q1a"; Q1B = "q1b"; Q1C = "q1c"; Q1D = "q1d"; Q1E = "q1e"
Q1F = "q1f"; Q1G = "q1g"; Q1H = "q1h"; Q1I = "q1i"; Q1J = "q1j"
Q2A = "q2a"; Q2B = "q2b"
Q3A1 = "q3a1"; Q3A2 = "q3a2"; Q3A3 = "q3a3"; Q3B = "q3b"
Q4A = "q4a"; Q4B = "q4b"; Q4C = "q4c"; Q4D = "q4d"
Q5A = "q5a"; Q5B = "q5b"; Q5C = "q5c"
Q6A = "q6a"; Q6B = "q6b"; Q6C = "q6c"

EXAM_ID = "comp1023-midterm-f25"

# ---- Correct answers -------------------------------------------------

CORRECT_ANSWERS: dict[str, str] = {
    Q1A: "F",
    Q1B: "F",
    Q1C: "F",
    Q1D: "T",
    Q1E: "F",
    Q1F: "T",
    Q1G: "T",
    Q1H: "F",
    Q1I: "T",
    Q1J: "T",
    Q2A: "0 | 2 | 6 | 5 | 12 | 8 | /",
    Q2B: "162\nThe loop terminates by running out of items naturally (no break is triggered).",
}

# ---- Build questions -------------------------------------------------

def _tf_question(qid: str, order: int, label: str, prompt: str) -> ExamQuestionIn:
    """Create a True/False MCQ question."""
    return ExamQuestionIn(
        id=qid,
        order=order,
        title=f"Q1({label})",
        prompt=prompt,
        points=1.0,
        type_data=McqQuestionData(
            type="mcq",
            options=[
                McqOption(id="T", label="True", is_correct=(CORRECT_ANSWERS[qid] == "T")),
                McqOption(id="F", label="False", is_correct=(CORRECT_ANSWERS[qid] == "F")),
            ],
            allow_multiple=False,
        ),
    )


# Problem 1 T/F questions
_P1_PROMPTS = {
    Q1A: "`int` and `float` objects are mutable, meaning their contents can be updated.",
    Q1B: 'The output of the following program is `1023`.\n```python\ndef main() -> None:\n    a: int = 10\n    b: int = 23\n    a, b = b, a\n    print(a, b, sep="")\n\nif __name__ == "__main__":\n    main()\n```',
    Q1C: 'The following code reports an error.\n```python\ndef main() -> None:\n    x: int = 0\n    if x and 10 / x > 1:\n        print("Yes")\n    else:\n        print("No")\n\nif __name__ == "__main__":\n    main()\n```',
    Q1D: 'The output of the following program is `haha`.\n```python\ndef main() -> None:\n    my_var: None = None\n    if my_var == None:\n        print("h", sep=\'a\', end=\'a\')\n    if my_var is None:\n        print("h", sep=\'a\', end=\'a\')\n    print()\n\nif __name__ == "__main__":\n    main()\n```',
    Q1E: 'The output of the following program is `Success`.\n```python\ndef main() -> None:\n    counter: int = 0\n    while counter < 3:\n        counter += 1\n        if counter == 3:\n            break\n    else:\n        print("Success")\n\nif __name__ == "__main__":\n    main()\n```',
    Q1F: 'The output of the following program is `13`.\n```python\ndef main() -> None:\n    for x in "COMP1023":\n        if x.isdigit() and int(x) % 2:\n            print(x, end=\'\')\n    print()\n\nif __name__ == "__main__":\n    main()\n```',
    Q1G: 'The output of the following program is `F`.\n```python\ndef main() -> None:\n    print(\'T\' if type(range(5)[0:2]) == type([]) else \'F\')\n\nif __name__ == "__main__":\n    main()\n```',
    Q1H: "If `x` is a list with 5 elements, the slice operation `x[10:]` will raise an error and cannot be executed.",
    Q1I: "If a Python function does not explicitly return a value, it returns `None` by default.",
    Q1J: 'The output of the following program is `[[99, 2, 3], [4, 5, 6]]`.\n```python\nimport copy\n\ndef main():\n    original_list = [[1, 2, 3], [4, 5, 6]]\n    shallow_copied_list = copy.copy(original_list)\n    shallow_copied_list[0][0] = 99\n    print(original_list)\n\nif __name__ == "__main__":\n    main()\n```',
}

# Problem 2 – trace table & short answer
_Q2A_PROMPT = """Analyze the following function:

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

Given the list `data = [1, None, 3, 1, -7, -4, 5]`, call `branch_and_loop(data)` and provide the value of `total` after processing each element. If an element is not processed (loop has exited), write `/`.

Format your answer as 7 values separated by ` | ` for elements: 1, None, 3, 1, -7, -4, 5"""

_Q2B_PROMPT = """Using the same `branch_and_loop` function from Part (a):

Consider `data2 = [None, 6, 9]`. When `branch_and_loop(data2)` is executed:
1. What is the return value of the function?
2. Why does the loop terminate? (break, natural exhaustion, or other reason?)"""

# Problem 3 coding questions
_Q3A1_PROMPT = """Implement a Python function `is_divisible(n, k)` that checks whether `n` is divisible by `k`. Both `n` and `k` are positive integers. You can assume `n` is always larger than `k`.

Examples:
- `is_divisible(10, 5)` → `True`
- `is_divisible(10, 3)` → `False`"""

_Q3A2_PROMPT = """Implement a Python function `is_prime(n)` that checks whether `n` is a prime number using a for-loop. Break the loop as early as possible. You can assume `n` is a natural number greater than 1. You must reuse `is_divisible` from (a)(i).

Examples:
- `is_prime(7)` → `True`
- `is_prime(9)` → `False`"""

_Q3A3_PROMPT = """Implement a Python function `get_primes(n)` using a for-loop that returns two outputs: the count of prime numbers in [2, n] and a list of those primes. You can assume `n > 2`. You must reuse `is_prime` from (a)(ii).

Example:
- `get_primes(10)` → `(4, [2, 3, 5, 7])`"""

_Q3B_PROMPT = """Implement a function `rotate_clockwise(lst)` that takes a square 2D list (n×n) and returns a new 2D list rotated 90 degrees clockwise. You must use a new 2D list to store the output.

Example:
- Input: `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]`
- Output: `[[7, 4, 1], [8, 5, 2], [9, 6, 3]]`"""

# Problem 4 coding questions
_Q4A_PROMPT = """Implement `print_balance(balance)` that prints the current balance in the format: `Your balance is $<balance>`."""

_Q4B_PROMPT = """Implement `print_bag(bag)` that prints all items in the player's bag on one line in the format: `Your bag contains: item1 item2 ...`"""

_Q4C_PROMPT = """Implement `put_in_bag(bag, item, amount)` that adds a given item to the bag `amount` times and returns the updated bag."""

_Q4D_PROMPT = """Implement `purchase_item(balance, item, price, amount=1)` that attempts to buy an item:
- If enough balance: deduct `price * amount` and return `(new_balance, item, amount)`
- If not enough: return `(balance, item, 0)`
The parameter `amount` should default to `1`."""

# Problem 5 coding questions
_Q5A_PROMPT = """Implement `initialize_game()` to set up and return the initial game state list for a number guessing game.
The state is: [secret_number, attempts, max_attempts, low_bound, high_bound, game_over]
- secret_number: random int 1-100
- attempts: 0
- max_attempts: 10
- low_bound: 1, high_bound: 100
- game_over: False"""

_Q5B_PROMPT = """Implement `get_valid_guess(game_state)` that prompts the user for a valid guess.
- Display: `Attempt {attempts+1} (Range: {low_bound}-{high_bound}): `
- If input has non-digit chars → print `Invalid input! Please enter a whole number.` and re-prompt.
- If integer outside [low_bound, high_bound] → print `Please enter a number between {low_bound} and {high_bound}.` and re-prompt.
- Return valid integer. Do NOT increment attempt counter."""

_Q5C_PROMPT = """Implement `process_guess(guess, game_state)` to process the user's validated guess:
- Increment attempt counter.
- If correct: print congratulations message and set game_over = True.
- If too high: print `Too high!` and update high_bound = guess - 1.
- If too low: print `Too low!` and update low_bound = guess + 1.
- Return the updated game state."""

# Problem 6 coding questions
_Q6A_PROMPT = """Implement `transpose(sales_list)` that returns a transposed copy of a 2D list using only ONE statement (list comprehension). No lambda or semicolons.

Example: `transpose([[1, 2, 3], [4, 5, 6]])` → `[[1, 4], [2, 5], [3, 6]]`"""

_Q6B_PROMPT = """Implement `shift(sales_list, days)` that returns a copy with columns shifted LEFT by `days` using only ONE statement. No lambda or semicolons.

Examples:
- `shift([[1, 2, 3], [4, 5, 6]], 1)` → `[[2, 3, 1], [5, 6, 4]]`
- `shift([[1, 2, 3], [4, 5, 6]], 2)` → `[[3, 1, 2], [6, 4, 5]]`"""

_Q6C_PROMPT = """Implement `shift_right(sales_list, days)` that shifts columns RIGHT by `days`. Use only ONE statement. No loops, list comprehension, lambda, or semicolons. Reuse `shift()` from part (b).

Examples:
- `shift_right([[1, 2, 3], [4, 5, 6]], 1)` → `[[3, 1, 2], [6, 4, 5]]`
- `shift_right([[1, 2, 3], [4, 5, 6]], 2)` → `[[2, 3, 1], [5, 6, 4]]`"""


# ---- Model answer strings for rubric context -------------------------

MODEL_ANSWERS: dict[str, str] = {
    Q3A1: "def is_divisible(n, k):\n    return n % k == 0",
    Q3A2: "def is_prime(n):\n    if n == 2:\n        return True\n    for i in range(2, int(n**0.5) + 1):\n        if is_divisible(n, i):\n            return False\n    return True",
    Q3A3: "def get_primes(n):\n    count = 0\n    primes = []\n    for i in range(2, n + 1):\n        if is_prime(i):\n            count += 1\n            primes.append(i)\n    return count, primes",
    Q3B: "def rotate_clockwise(lst):\n    n = len(lst)\n    rotated = [[0] * n for _ in range(n)]\n    for i in range(n):\n        for j in range(n):\n            rotated[j][n - 1 - i] = lst[i][j]\n    return rotated",
    Q4A: 'def print_balance(balance):\n    print("Your balance is $" + str(balance))',
    Q4B: 'def print_bag(bag):\n    print("Your bag contains:", *bag)',
    Q4C: "def put_in_bag(bag, item, amount):\n    for _ in range(amount):\n        bag.append(item)\n    return bag",
    Q4D: "def purchase_item(balance, item, price, amount=1):\n    if balance >= price * amount:\n        balance -= price * amount\n        return balance, item, amount\n    else:\n        return balance, item, 0",
    Q5A: "def initialize_game():\n    secret_number = random.randint(1, 100)\n    return [secret_number, 0, 10, 1, 100, False]",
    Q5B: 'def get_valid_guess(game_state):\n    while True:\n        guess_input = input(f"Attempt {game_state[1] + 1} (Range: {game_state[3]}-{game_state[4]}): ")\n        if not guess_input.isdigit():\n            print("Invalid input! Please enter a whole number.")\n            continue\n        guess = int(guess_input)\n        if guess < game_state[3] or guess > game_state[4]:\n            print(f"Please enter a number between {game_state[3]} and {game_state[4]}.")\n            continue\n        return guess',
    Q5C: 'def process_guess(guess, game_state):\n    game_state[1] += 1\n    if guess == game_state[0]:\n        print(f"Congratulations! You guessed the number {game_state[0]} in {game_state[1]} attempts!")\n        game_state[5] = True\n    elif guess > game_state[0]:\n        print("Too high!")\n        game_state[4] = guess - 1\n    else:\n        print("Too low!")\n        game_state[3] = guess + 1\n    return game_state',
    Q6A: "def transpose(sales_list):\n    return [[row[i] for row in sales_list] for i in range(len(sales_list[0]))]",
    Q6B: "def shift(sales_list, days):\n    return [row[days % len(row):] + row[:days % len(row)] for row in sales_list]",
    Q6C: "def shift_right(sales_list, days):\n    return shift(sales_list, -(days % len(sales_list[0])))",
}


def build_comp1023_exam() -> ExamDefinitionOut:
    """Build the full COMP1023 midterm exam definition."""
    questions: list[ExamQuestionIn] = []
    order = 1

    # Problem 1: T/F (a-j)
    labels = "abcdefghij"
    qids = [Q1A, Q1B, Q1C, Q1D, Q1E, Q1F, Q1G, Q1H, Q1I, Q1J]
    for qid, label in zip(qids, labels):
        questions.append(_tf_question(qid, order, label, _P1_PROMPTS[qid]))
        order += 1

    # Problem 2a – trace table (short answer, 7 pts)
    questions.append(ExamQuestionIn(
        id=Q2A, order=order, title="Q2(a) – Trace Table",
        prompt=_Q2A_PROMPT, points=7.0,
        type_data=ShortAnswerQuestionData(type="short_answer"),
        rubric=QuestionRubric(text="1 point for each correct total value (7 values)."),
    ))
    order += 1

    # Problem 2b – return value + reason (short answer, 3 pts)
    questions.append(ExamQuestionIn(
        id=Q2B, order=order, title="Q2(b) – Return Value & Termination",
        prompt=_Q2B_PROMPT, points=3.0,
        type_data=ShortAnswerQuestionData(type="short_answer"),
        rubric=QuestionRubric(text="1.5 pts for correct return value (162). 1.5 pts for correct reason (natural exhaustion)."),
    ))
    order += 1

    # Problem 3 – coding
    for qid, title, prompt, pts in [
        (Q3A1, "Q3(a)(i) – is_divisible", _Q3A1_PROMPT, 1.0),
        (Q3A2, "Q3(a)(ii) – is_prime", _Q3A2_PROMPT, 4.0),
        (Q3A3, "Q3(a)(iii) – get_primes", _Q3A3_PROMPT, 6.0),
        (Q3B, "Q3(b) – rotate_clockwise", _Q3B_PROMPT, 7.0),
    ]:
        questions.append(ExamQuestionIn(
            id=qid, order=order, title=title, prompt=prompt, points=pts,
            type_data=CodingQuestionData(type="coding", language="python"),
            rubric=QuestionRubric(text=f"Model answer:\n{MODEL_ANSWERS[qid]}"),
        ))
        order += 1

    # Problem 4 – coding
    for qid, title, prompt, pts in [
        (Q4A, "Q4(a) – print_balance", _Q4A_PROMPT, 2.0),
        (Q4B, "Q4(b) – print_bag", _Q4B_PROMPT, 6.0),
        (Q4C, "Q4(c) – put_in_bag", _Q4C_PROMPT, 4.0),
        (Q4D, "Q4(d) – purchase_item", _Q4D_PROMPT, 8.0),
    ]:
        questions.append(ExamQuestionIn(
            id=qid, order=order, title=title, prompt=prompt, points=pts,
            type_data=CodingQuestionData(type="coding", language="python"),
            rubric=QuestionRubric(text=f"Model answer:\n{MODEL_ANSWERS[qid]}"),
        ))
        order += 1

    # Problem 5 – coding
    for qid, title, prompt, pts in [
        (Q5A, "Q5(a) – initialize_game", _Q5A_PROMPT, 4.0),
        (Q5B, "Q5(b) – get_valid_guess", _Q5B_PROMPT, 11.0),
        (Q5C, "Q5(c) – process_guess", _Q5C_PROMPT, 11.0),
    ]:
        questions.append(ExamQuestionIn(
            id=qid, order=order, title=title, prompt=prompt, points=pts,
            type_data=CodingQuestionData(type="coding", language="python"),
            rubric=QuestionRubric(text=f"Model answer:\n{MODEL_ANSWERS[qid]}"),
        ))
        order += 1

    # Problem 6 – coding
    for qid, title, prompt, pts in [
        (Q6A, "Q6(a) – transpose", _Q6A_PROMPT, 6.0),
        (Q6B, "Q6(b) – shift", _Q6B_PROMPT, 5.0),
        (Q6C, "Q6(c) – shift_right", _Q6C_PROMPT, 5.0),
    ]:
        questions.append(ExamQuestionIn(
            id=qid, order=order, title=title, prompt=prompt, points=pts,
            type_data=CodingQuestionData(type="coding", language="python"),
            rubric=QuestionRubric(text=f"Model answer:\n{MODEL_ANSWERS[qid]}"),
        ))
        order += 1

    now = datetime.utcnow()
    return ExamDefinitionOut(
        id=EXAM_ID,
        course_code="COMP1023",
        course_name="Introduction to Python Programming",
        title="Midterm Exam – Fall 2025",
        date="2025-10-25",
        start_time="13:00",
        duration_seconds=7200,
        location="HKUST",
        instructions="Closed-book, closed-notes. All code in Python.",
        questions=questions,
        total_points=sum(q.points for q in questions),
        created_at=now,
        updated_at=now,
    )


def build_comp1023_rubrics() -> dict[str, StructuredRubric]:
    """Build structured rubrics for every question."""
    rubrics: dict[str, StructuredRubric] = {}

    # T/F questions – simple 1pt rubric
    for qid in [Q1A, Q1B, Q1C, Q1D, Q1E, Q1F, Q1G, Q1H, Q1I, Q1J]:
        rubrics[qid] = StructuredRubric(
            question_id=qid,
            criteria=[RubricCriterion(
                id="correctness", label="Correct Answer",
                description=f"Correct answer is {CORRECT_ANSWERS[qid]}. No partial credit.",
                max_points=1.0,
            )],
            total_points=1.0,
        )

    # Q2a – 7 points, 1 per element
    rubrics[Q2A] = StructuredRubric(
        question_id=Q2A,
        criteria=[RubricCriterion(
            id="trace", label="Trace Table Values",
            description="1 point per correct value. Expected: 0 | 2 | 6 | 5 | 12 | 8 | /",
            max_points=7.0,
        )],
        total_points=7.0,
    )

    # Q2b – 3 points
    rubrics[Q2B] = StructuredRubric(
        question_id=Q2B,
        criteria=[
            RubricCriterion(id="return_val", label="Return Value", description="Correct return value is 162.", max_points=1.5),
            RubricCriterion(id="termination", label="Termination Reason", description="Loop runs out of items naturally (no break).", max_points=1.5),
        ],
        total_points=3.0,
    )

    # Coding questions – detailed rubrics with model answers
    _coding_rubrics = {
        Q3A1: [("modulus", "Uses modulus operator (%)", 0.5), ("return_bool", "Returns boolean correctly", 0.5)],
        Q3A2: [("reuse", "Reuses is_divisible", 1.0), ("early_break", "Breaks early", 1.0), ("range", "Loop range 2 to √n", 1.0), ("edge", "Handles n==2", 1.0)],
        Q3A3: [("reuse", "Reuses is_prime", 1.5), ("loop_range", "Loop 2 to n+1", 1.5), ("count", "Counts primes", 1.5), ("return", "Returns count and list", 1.5)],
        Q3B: [("len", "Gets n=len(lst)", 0.5), ("init_2d", "Initializes new n×n list", 2.0), ("loops", "Two loops 0 to n", 1.5), ("index", "Correct index mapping", 2.0), ("return", "Returns rotated list", 1.0)],
        Q4A: [("func_def", "Correct function def", 0.5), ("param", "Correct parameter", 0.5), ("print_prefix", "Prints 'Your balance is $'", 0.5), ("print_val", "Prints balance value", 0.5)],
        Q4B: [("func_def", "Correct function def", 0.5), ("param", "Correct parameter", 0.5), ("prefix", "Prints 'Your bag contains:'", 1.0), ("loop", "Loop to print items", 2.0), ("format", "Space-separated on one line", 2.0)],
        Q4C: [("func_def", "Correct function def", 0.5), ("params", "Correct params (bag, item, amount)", 1.0), ("loop", "Loop to add items", 2.0), ("return", "Returns updated bag", 0.5)],
        Q4D: [("func_def", "Correct function def", 0.5), ("params", "Correct params", 1.5), ("default", "Default amount=1", 1.0), ("logic", "Balance deduction logic", 2.5), ("return", "Returns correct tuple", 2.5)],
        Q5A: [("random", "Generates random 1-100", 2.0), ("state_list", "Returns correct 6-element list", 2.0)],
        Q5B: [("input", "Gets user input", 1.0), ("prompt", "Correct prompt text", 1.5), ("non_digit", "Handles non-digit input", 3.0), ("convert", "Converts to int", 1.5), ("range_check", "Checks valid range", 3.0), ("return", "Returns valid guess", 1.0)],
        Q5C: [("increment", "Increments attempt counter", 1.0), ("eq_test", "Tests equality", 1.0), ("congrats", "Prints congratulations", 1.5), ("game_over", "Sets game_over True", 1.0), ("gt_test", "Tests greater than", 1.0), ("too_high_msg", "Prints Too high!", 1.0), ("high_bound", "Updates high_bound", 1.0), ("else", "Handles else/too low", 1.0), ("too_low_msg", "Prints Too low!", 1.0), ("low_bound", "Updates low_bound", 1.0), ("return", "Returns game state", 0.5)],
        Q6A: [("cols", "Gets column count", 1.0), ("outer", "Outer loop over columns", 1.0), ("rows", "Gets row count", 1.0), ("inner", "Inner loop over rows", 1.0), ("index", "Correct indexing", 2.0)],
        Q6B: [("modulo", "Handles days > len(row)", 1.0), ("mod_op", "Uses % operator", 1.0), ("slice_right", "Slices from days onwards", 0.75), ("slice_left", "Slices 0 to days", 0.75), ("cols", "Gets column count", 1.0), ("iter", "Iterates rows", 0.5)],
        Q6C: [("pass_list", "Passes sales_list to shift", 1.0), ("tail_call", "Uses return shift(...)", 2.0), ("large_days", "Handles large days", 1.0), ("negate", "Negates or computes complement", 1.0)],
    }

    for qid, criteria_data in _coding_rubrics.items():
        rubrics[qid] = StructuredRubric(
            question_id=qid,
            criteria=[
                RubricCriterion(id=cid, label=lbl, description=lbl, max_points=pts)
                for cid, lbl, pts in criteria_data
            ],
            total_points=sum(pts for _, _, pts in criteria_data),
        )

    return rubrics
