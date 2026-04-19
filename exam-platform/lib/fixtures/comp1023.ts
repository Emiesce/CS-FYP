/* ------------------------------------------------------------------ */
/*  COMP1023 Midterm – Frontend exam definition + exam entry          */
/*  Maps the backend fixture into the frontend ExamDefinition type.   */
/* ------------------------------------------------------------------ */

import type { Exam, ExamDefinition } from "@/types";

export const COMP1023_EXAM_ID = "comp1023-midterm-s26";

/** The exam entry for dashboards. */
export const COMP1023_EXAM: Exam = {
  id: COMP1023_EXAM_ID,
  courseCode: "COMP1023",
  courseName: "Introduction to Python Programming",
  title: "Midterm Exam – Spring 2026",
  date: "2026-03-15",
  startTime: "13:00",
  durationSeconds: 180, // 3-minute demo for testing
  location: "HKUST",
  status: "current",
  studentCount: 35,
  semesterId: "2025-26-spring",
};

/** Full exam definition with all 27 questions for the workspace shell. */
export const COMP1023_EXAM_DEFINITION: ExamDefinition = {
  id: COMP1023_EXAM_ID,
  courseCode: "COMP1023",
  courseName: "Introduction to Python Programming",
  title: "Midterm Exam – Spring 2026",
  date: "2026-03-15",
  startTime: "13:00",
  durationSeconds: 180,
  location: "HKUST",
  instructions:
    "Closed-book, closed-notes. All code must be in Python. Answer all questions.",
  totalPoints: 100,
  createdAt: "2026-02-01T10:00:00Z",
  updatedAt: "2026-03-10T14:30:00Z",
  questions: [
    // Problem 1: True/False (a-j) — 10 × 1pt MCQ
    ...([
      ["q1a", "Q1(a)", "`int` and `float` objects are mutable, meaning their contents can be updated."],
      ["q1b", "Q1(b)", "The output of the following program is `1023`.\n```python\ndef main() -> None:\n    a: int = 10\n    b: int = 23\n    a, b = b, a\n    print(a, b, sep=\"\")\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1c", "Q1(c)", "The following code reports an error.\n```python\ndef main() -> None:\n    x: int = 0\n    if x and 10 / x > 1:\n        print(\"Yes\")\n    else:\n        print(\"No\")\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1d", "Q1(d)", "The output of the following program is `haha`.\n```python\ndef main() -> None:\n    my_var: None = None\n    if my_var == None:\n        print(\"h\", sep='a', end='a')\n    if my_var is None:\n        print(\"h\", sep='a', end='a')\n    print()\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1e", "Q1(e)", "The output of the following program is `Success`.\n```python\ndef main() -> None:\n    counter: int = 0\n    while counter < 3:\n        counter += 1\n        if counter == 3:\n            break\n    else:\n        print(\"Success\")\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1f", "Q1(f)", "The output of the following program is `13`.\n```python\ndef main() -> None:\n    for x in \"COMP1023\":\n        if x.isdigit() and int(x) % 2:\n            print(x, end='')\n    print()\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1g", "Q1(g)", "The output of the following program is `F`.\n```python\ndef main() -> None:\n    print('T' if type(range(5)[0:2]) == type([]) else 'F')\n\nif __name__ == \"__main__\":\n    main()\n```"],
      ["q1h", "Q1(h)", "If `x` is a list with 5 elements, the slice operation `x[10:]` will raise an error and cannot be executed."],
      ["q1i", "Q1(i)", "If a Python function does not explicitly return a value, it returns `None` by default."],
      ["q1j", "Q1(j)", "The output of the following program is `[[99, 2, 3], [4, 5, 6]]`.\n```python\nimport copy\n\ndef main():\n    original_list = [[1, 2, 3], [4, 5, 6]]\n    shallow_copied_list = copy.copy(original_list)\n    shallow_copied_list[0][0] = 99\n    print(original_list)\n\nif __name__ == \"__main__\":\n    main()\n```"],
    ] as [string, string, string][]).map(([id, title, prompt], i) => ({
      id,
      order: i + 1,
      type: "mcq" as const,
      title,
      prompt,
      points: 1,
      required: true,
      options: [
        { id: "T", label: "True", isCorrect: false },
        { id: "F", label: "False", isCorrect: false },
      ],
      allowMultiple: false,
    })),

    // Problem 2: Short Answer
    {
      id: "q2a", order: 11, type: "short_answer" as const,
      title: "Q2(a) – Trace Table",
      prompt: `Analyze the following function:

\`\`\`python
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
\`\`\`

Given the list \`data = [1, None, 3, 1, -7, -4, 5]\`, call \`branch_and_loop(data)\` and provide the value of \`total\` after processing each element. If an element is not processed (loop has exited), write \`/\`.

Format your answer as 7 values separated by \` | \` for elements: 1, None, 3, 1, -7, -4, 5`,
      points: 7, required: true, maxLength: 200, placeholder: "e.g. 0 | 2 | 6 | ...",
    },
    {
      id: "q2b", order: 12, type: "short_answer" as const,
      title: "Q2(b) – Return Value & Termination",
      prompt: `Using the same \`branch_and_loop\` function from Part (a):

Consider \`data2 = [None, 6, 9]\`. When \`branch_and_loop(data2)\` is executed:
1. What is the return value of the function?
2. Why does the loop terminate? (break, natural exhaustion, or other reason?)`,
      points: 3, required: true, maxLength: 300, placeholder: "Type your answer here…",
    },

    // Problem 3: Coding
    { id: "q3a1", order: 13, type: "coding" as const, title: "Q3(a)(i) – is_divisible", prompt: "Implement a Python function `is_divisible(n, k)` that checks whether `n` is divisible by `k`. Both `n` and `k` are positive integers.", points: 1, required: true, language: "python", starterCode: "def is_divisible(n, k):\n    # TODO: implement\n    pass\n" },
    { id: "q3a2", order: 14, type: "coding" as const, title: "Q3(a)(ii) – is_prime", prompt: "Implement a Python function `is_prime(n)` that checks whether `n` is a prime number using a for-loop. Break the loop as early as possible. You must reuse `is_divisible` from (a)(i).", points: 4, required: true, language: "python", starterCode: "def is_prime(n):\n    # TODO: implement\n    pass\n" },
    { id: "q3a3", order: 15, type: "coding" as const, title: "Q3(a)(iii) – get_primes", prompt: "Implement a Python function `get_primes(n)` that returns two outputs: the count of prime numbers in [2, n] and a list of those primes. You must reuse `is_prime` from (a)(ii).", points: 6, required: true, language: "python", starterCode: "def get_primes(n):\n    # TODO: implement\n    pass\n" },
    { id: "q3b", order: 16, type: "coding" as const, title: "Q3(b) – rotate_clockwise", prompt: "Implement a function `rotate_clockwise(lst)` that takes a square 2D list (n×n) and returns a new 2D list rotated 90 degrees clockwise.", points: 7, required: true, language: "python", starterCode: "def rotate_clockwise(lst):\n    # TODO: implement\n    pass\n" },

    // Problem 4: Coding
    { id: "q4a", order: 17, type: "coding" as const, title: "Q4(a) – print_balance", prompt: "Implement `print_balance(balance)` that prints the current balance in the format: `Your balance is $<balance>`.", points: 2, required: true, language: "python", starterCode: "def print_balance(balance):\n    # TODO: implement\n    pass\n" },
    { id: "q4b", order: 18, type: "coding" as const, title: "Q4(b) – print_bag", prompt: "Implement `print_bag(bag)` that prints all items in the player's bag on one line in the format: `Your bag contains: item1 item2 ...`", points: 6, required: true, language: "python", starterCode: "def print_bag(bag):\n    # TODO: implement\n    pass\n" },
    { id: "q4c", order: 19, type: "coding" as const, title: "Q4(c) – put_in_bag", prompt: "Implement `put_in_bag(bag, item, amount)` that adds a given item to the bag `amount` times and returns the updated bag.", points: 4, required: true, language: "python", starterCode: "def put_in_bag(bag, item, amount):\n    # TODO: implement\n    pass\n" },
    { id: "q4d", order: 20, type: "coding" as const, title: "Q4(d) – purchase_item", prompt: "Implement `purchase_item(balance, item, price, amount=1)` that attempts to buy an item:\n- If enough balance: deduct `price * amount` and return `(new_balance, item, amount)`\n- If not enough: return `(balance, item, 0)`", points: 8, required: true, language: "python", starterCode: "def purchase_item(balance, item, price, amount=1):\n    # TODO: implement\n    pass\n" },

    // Problem 5: Coding
    { id: "q5a", order: 21, type: "coding" as const, title: "Q5(a) – initialize_game", prompt: "Implement `initialize_game()` to set up and return the initial game state list: [secret_number (1-100), attempts (0), max_attempts (10), low_bound (1), high_bound (100), game_over (False)].", points: 4, required: true, language: "python", starterCode: "import random\n\ndef initialize_game():\n    # TODO: implement\n    pass\n" },
    { id: "q5b", order: 22, type: "coding" as const, title: "Q5(b) – get_valid_guess", prompt: "Implement `get_valid_guess(game_state)` that prompts the user for a valid guess within [low_bound, high_bound]. Handle non-digit input and out-of-range values with appropriate messages.", points: 11, required: true, language: "python", starterCode: "def get_valid_guess(game_state):\n    # TODO: implement\n    pass\n" },
    { id: "q5c", order: 23, type: "coding" as const, title: "Q5(c) – process_guess", prompt: "Implement `process_guess(guess, game_state)` to process the user's validated guess. Increment attempt counter, check if correct/too high/too low, update bounds, and return updated game state.", points: 11, required: true, language: "python", starterCode: "def process_guess(guess, game_state):\n    # TODO: implement\n    pass\n" },

    // Problem 6: Coding
    { id: "q6a", order: 24, type: "coding" as const, title: "Q6(a) – transpose", prompt: "Implement `transpose(sales_list)` that returns a transposed copy of a 2D list using only ONE statement (list comprehension).", points: 6, required: true, language: "python", starterCode: "def transpose(sales_list):\n    # TODO: implement\n    pass\n" },
    { id: "q6b", order: 25, type: "coding" as const, title: "Q6(b) – shift", prompt: "Implement `shift(sales_list, days)` that returns a copy with columns shifted LEFT by `days` using only ONE statement.", points: 5, required: true, language: "python", starterCode: "def shift(sales_list, days):\n    # TODO: implement\n    pass\n" },
    { id: "q6c", order: 26, type: "coding" as const, title: "Q6(c) – shift_right", prompt: "Implement `shift_right(sales_list, days)` that shifts columns RIGHT by `days`. Use only ONE statement. Reuse `shift()` from part (b).", points: 5, required: true, language: "python", starterCode: "def shift_right(sales_list, days):\n    # TODO: implement\n    pass\n" },
  ],
};
