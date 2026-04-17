# COMP 1023 Midterm Exam — Fall 2025 — HKUST

**Date:** October 25, 2025 (Saturday)
**Time Allowed:** 2 hours (1:00–3:00 pm)

---

## General Instructions

1. This is a closed-book, closed-notes examination.
2. There are **6 questions** worth **100 points** in total.
3. All programming code must be written in **Python** as taught in class.
4. Unless otherwise stated, you are **NOT** allowed to define additional classes, helper functions (including inner functions), use global variables, or use library functions not mentioned in the questions.
5. Type hinting does not need to be included in your code.
6. No electronic devices are allowed, except for an HKEAA approved calculator.

---

## Score Summary

| Problem | Topic                            | Points |
|---------|----------------------------------|--------|
| 1       | True/False Questions             | /10    |
| 2       | Branching and Looping Statements | /10    |
| 3       | Functions and Lists              | /18    |
| 4       | Mini Store System                | /20    |
| 5       | Number Guessing Game             | /26    |
| 6       | Sales of Car Accessories         | /16    |
| **Total** |                                | **/100** |

---

## Problem 1 — True/False Questions [10 points]

**Category:** MCQ

Indicate whether each of the following statements is **True (T)** or **False (F)**. You get **1 point** for each correct answer.

---

**(a)** `int` and `float` objects are mutable, meaning their contents can be updated.

> **Answer:** F
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(b)** The output of the following program is `1023`.

```python
def main() -> None:
    a: int = 10
    b: int = 23
    a, b = b, a
    print(a, b, sep="")

if __name__ == "__main__":
    main()
```

> **Answer:** F
>
> **Explanation:** After `a, b = b, a`, `a = 23` and `b = 10`. So the output is `2310`, not `1023`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(c)** The following code reports an error.

```python
def main() -> None:
    x: int = 0
    if x and 10 / x > 1:
        print("Yes")
    else:
        print("No")

if __name__ == "__main__":
    main()
```

> **Answer:** F
>
> **Explanation:** Due to short-circuit evaluation, since `x` is `0` (falsy), `10 / x` is never evaluated. No `ZeroDivisionError` occurs. Output is `No`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(d)** The output of the following program is `haha`.

```python
def main() -> None:
    my_var: None = None
    if my_var == None:
        print("h", sep='a', end='a')
    if my_var is None:
        print("h", sep='a', end='a')
    print()

if __name__ == "__main__":
    main()
```

> **Answer:** T
>
> **Explanation:** Both conditions are true. Each `print("h", sep='a', end='a')` outputs `ha` (sep does not apply to single arguments; end replaces the newline). Final `print()` adds the newline. Combined output is `haha`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(e)** The output of the following program is `Success`.

```python
def main() -> None:
    counter: int = 0
    while counter < 3:
        counter += 1
        if counter == 3:
            break
    else:
        print("Success")

if __name__ == "__main__":
    main()
```

> **Answer:** F
>
> **Explanation:** The `while` loop exits via `break` when `counter == 3`. The `else` clause of a `while` loop only executes if the loop terminates naturally (not via `break`). So `"Success"` is **not** printed.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(f)** The output of the following program is `13`.

```python
def main() -> None:
    for x in "COMP1023":
        if x.isdigit() and int(x) % 2:
            print(x, end='')
    print()

if __name__ == "__main__":
    main()
```

> **Answer:** T
>
> **Explanation:** Digits in `"COMP1023"` are `1`, `0`, `2`, `3`. Odd digits: `1`, `3`. Output is `13`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(g)** The output of the following program is `F`.

```python
def main() -> None:
    print('T' if type(range(5)[0:2]) == type([]) else 'F')

if __name__ == "__main__":
    main()
```

> **Answer:** T
>
> **Explanation:** `range(5)[0:2]` returns a `range` object, not a `list`. So `type(range(5)[0:2]) == type([])` is `False`, and `'F'` is printed.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(h)** If `x` is a list with 5 elements, the slice operation `x[10:]` will raise an error and cannot be executed.

> **Answer:** F
>
> **Explanation:** In Python, slicing beyond the list length does not raise an error; it returns an empty list `[]`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(i)** If a Python function does not explicitly return a value, it returns `None` by default.

> **Answer:** T
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

**(j)** The output of the following program is `[[99, 2, 3], [4, 5, 6]]`.

```python
import copy

def main():
    original_list = [[1, 2, 3], [4, 5, 6]]
    shallow_copied_list = copy.copy(original_list)
    shallow_copied_list[0][0] = 99
    print(original_list)

if __name__ == "__main__":
    main()
```

> **Answer:** T
>
> **Explanation:** `copy.copy()` performs a shallow copy. The outer list is a new object, but the inner lists are still the same references. Modifying `shallow_copied_list[0][0]` also modifies `original_list[0][0]`.
>
> **Rubric:** 1 point for correct answer. No partial credit.

---

## Problem 2 — Branching and Looping Statements [10 points]

**Category:** Short Answer

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

---

### Part (a) [7 points]

Given the list `data = [1, None, 3, 1, -7, -4, 5]`, call `branch_and_loop(data)` and complete the trace table below showing the value of `total` **after processing each element**. If an element is not processed (loop has exited), write `/`.

| Element | 1 | None | 3 | 1 | -7 | -4 | 5 |
|---------|---|------|---|---|----|----|---|
| Value of `total` after processing | ? | ? | ? | ? | ? | ? | ? |

> **Answer:**
>
> | Element | 1 | None | 3 | 1 | -7 | -4 | 5 |
> |---------|---|------|---|---|----|----|---|
> | `total` after processing | 0 | 2 | 6 | 5 | 12 | 8 | / |
>
> **Trace:**
> - Start: `total = 1`
> - `value = 1`: not None, `1 % 3 != 0`, `1 % 2 != 0` → else: `total -= 1` → `total = 0`
> - `value = None`: `total += 2` → `total = 2`, `continue`
> - `value = 3`: `3 % 3 == 0` → `total *= 3` → `total = 6`
> - `value = 1`: `1 % 3 != 0`, `1 % 2 != 0` → else: `total -= 1` → `total = 5`
> - `value = -7`: `-7 % 3 != 0`, `-7 % 2 != 0` → else: `total -= (-7)` → `total = 12`
> - `value = -4`: `-4 % 2 == 0` → `total += (-4)` → `total = 8`, `break`
> - `value = 5`: not processed (loop broken) → `/`
>
> **Rubric:** 1 point for each correct `total` value (7 points total).

---

### Part (b) [3 points]

Consider `data2 = [None, 6, 9]`. When `branch_and_loop(data2)` is executed:
1. What is the **return value** of the function?
2. **Why does the loop terminate?** (break, natural exhaustion, or other reason?)

> **Answer:**
> 1. Return value: **162**
> 2. The loop terminates by **running out of items naturally** (no `break` is triggered).
>
> **Trace:**
> - Start: `total = 1`
> - `value = None`: `total += 2` → `total = 3`, `continue`
> - `value = 6`: `6 % 3 == 0` → `total *= 6` → `total = 18`
> - `value = 9`: `9 % 3 == 0` → `total *= 9` → `total = 162`
> - Loop ends naturally. Return `162`.
>
> **Rubric:**
> - 1.5 points for correct return value (`162`).
> - 1.5 points for correct reason (runs out of items naturally).

---

## Problem 3 — Functions and Lists [18 points]

**Category:** Coding

### Part (a) — Prime Numbers [11 points]

A **prime number** is a natural number greater than 1 that has no positive divisors other than 1 and itself.

---

#### (a)(i) `is_divisible` [1 point]

Implement a Python function `is_divisible(n, k)` that checks whether `n` is divisible by `k`. Both `n` and `k` are positive integers. You can assume `n` is always larger than `k`.

**Examples:**
- `is_divisible(10, 5)` → `True`
- `is_divisible(10, 3)` → `False`

```python
def is_divisible(n, k):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def is_divisible(n: int, k: int) -> bool:
>     return n % k == 0
> ```
>
> **Rubric (1 point total):**
> - 0.5 points for checking divisibility using the modulus operator (`%`) without loops.
> - 0.5 points for correctly returning a boolean value.

---

#### (a)(ii) `is_prime` [4 points]

Implement a Python function `is_prime(n)` that checks whether `n` is a prime number using a **for-loop**. Break the loop **as early as possible**. You can assume `n` is a natural number greater than 1. **You must reuse `is_divisible` from (a)(i).**

**Examples:**
- `is_prime(7)` → `True`
- `is_prime(9)` → `False`

```python
def is_prime(n):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def is_prime(n: int) -> bool:
>     if n == 2:
>         return True
>     for i in range(2, int(n**0.5) + 1):
>         if is_divisible(n, i):
>             return False
>     return True
> ```
>
> **Rubric (4 points total):**
> - 1 point for correctly using `is_divisible` from (a)(i).
> - 1 point for breaking the loop early when a divisor is found.
> - 1 point for running the loop from `2` to at least `√n` (acceptable if loop runs from `2` to `n`).
> - 1 point for correctly handling the edge case `n == 2`.
>   - If loop iterates from `2` to `n`, no explicit edge case handling needed.
>   - If loop starts from `0`, edge cases `divisor == 0` and `divisor == 1` must be handled.
>   - If loop runs beyond `n`, edge case `divisor == n` must be handled.

---

#### (a)(iii) `get_primes` [6 points]

Implement a Python function `get_primes(n)` using a **for-loop** that returns **two outputs**: the count of prime numbers in `[2, n]` and a list of those primes. Break the loop **as early as possible**. You can assume `n > 2`. **You must reuse `is_prime` from (a)(ii).**

**Example:**
- `get_primes(10)` → `(4, [2, 3, 5, 7])`

```python
def get_primes(n):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def get_primes(n: int) -> tuple[int, list[int]]:
>     count: int = 0
>     primes: list[int] = []
>     for i in range(2, n + 1):
>         if is_prime(i):
>             count += 1
>             primes.append(i)
>     return count, primes
> ```
>
> **Rubric (6 points total):**
> - 1.5 points for using the `is_prime` function from (a)(ii).
> - 1.5 points for running the loop from `2` to `n+1`.
> - 1.5 points for correctly counting the primes.
> - 1.5 points for correctly returning the counted value and prime list.

---

### Part (b) — Rotate Clockwise [7 points]

You are given a **square** 2D list of size `n × n` (`n ≥ 1`), represented as a list of lists (each inner list is a row).

**Example visualization of `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]`:**
```
1 2 3
4 5 6
7 8 9
```

Implement a function `rotate_clockwise(lst)` that takes a square 2D list and returns a **new** 2D list rotated **90 degrees clockwise**. You must use a new 2D list to store the output.

**Example:**
- Input: `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]`
- Output: `[[7, 4, 1], [8, 5, 2], [9, 6, 3]]`

```python
def rotate_clockwise(lst):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def rotate_clockwise(lst: list[list[int]]) -> list[list[int]]:
>     n: int = len(lst)
>     rotated: list[list[int]] = [[0] * n for _ in range(n)]
>     for i in range(n):
>         for j in range(n):
>             rotated[j][n - 1 - i] = lst[i][j]
>     return rotated
> ```
>
> **Alternative solutions:**
> ```python
> def rotate_clockwise(lst):
>     n = len(lst)
>     rotated = []
>     for i in range(n):
>         new_row = []
>         for j in range(n-1, -1, -1):
>             new_row.append(lst[j][i])
>         rotated.append(new_row)
>     return rotated
> ```
>
> **Rubric (7 points total):**
> - 0.5 points for `n = len(lst)`.
> - 2 points for initializing a new `n×n` 2D list.
> - 1.5 points for having two loops that run from `0` to `n`.
> - 2 points for the correct value assignment (index mapping).
> - 1 point for correctly returning the rotated 2D list.
> - Deduct 0.25 points for each syntax error.
> - 0 points for hardcoding.
> - Additional functions not allowed.

---

## Problem 4 — Mini Store System [20 points]

**Category:** Coding

In this question, you will implement several Python functions to simulate a simple in-game store system. A player starts with a balance and a bag containing one item.

The `main` function (already written) is as follows:

```python
def main() -> None:
    balance: int = 500
    bag: list[str] = ["book"]
    print("Welcome to the store!")
    print_balance(balance)
    print_bag(bag)

    print("You want to buy a sword.")
    balance, item, amount = purchase_item(balance=balance, item="sword", price=100)
    bag = put_in_bag(bag, item, amount)
    print_bag(bag)

    print("You want to buy 2 health potions.")
    balance, item, amount = purchase_item(balance, "health_potion", 20, amount=2)
    bag = put_in_bag(bag, item, amount)
    print_bag(bag)

    print("You want to buy a golden apple.")
    balance, item, amount = purchase_item(balance, "golden_apple", 400)
    bag = put_in_bag(bag, item, amount)
    print_bag(bag)

    print("Thank you for your purchase!")
    print_balance(balance)
    print_bag(bag)

if __name__ == "__main__":
    main()
```

**Expected output:**
```
Welcome to the store!
Your balance is $500
Your bag contains: book
You want to buy a sword.
Your bag contains: book sword
You want to buy 2 health potions.
Your bag contains: book sword health_potion health_potion
You want to buy a golden apple.
Your bag contains: book sword health_potion health_potion
Thank you for your purchase!
Your balance is $360
Your bag contains: book sword health_potion health_potion
```

For each function below, write the **complete function header and body**.

---

### Part (a) — `print_balance` [2 points]

Implement `print_balance` that prints the current balance in the format: `Your balance is $<balance>`.

```python
def print_balance(balance):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def print_balance(balance: int) -> None:
>     print("Your balance is $" + str(balance))
> ```
>
> **Rubric (2 points total):**
> - 0.5 points for correctly defining the function with the name `print_balance`.
> - 0.5 points for correctly defining the function parameter `balance`.
> - 0.5 points for correctly printing `"Your balance is $"`.
> - 0.5 points for correctly printing `balance`.

---

### Part (b) — `print_bag` [6 points]

Implement `print_bag` that prints all items in the player's bag **on one line** in the format: `Your bag contains: item1 item2 ...`

```python
def print_bag(bag):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def print_bag(bag: list[str]) -> None:
>     print("Your bag contains: ", end="")
>     for item in bag:
>         print(item, end=" ")
>     print()
> ```
>
> **Alternative:**
> ```python
> def print_bag(bag: list[str]) -> None:
>     print("Your bag contains:", *bag)
> ```
>
> **Rubric (6 points total):**
> - 0.5 points for correctly defining the function with the name `print_bag`.
> - 0.5 points for correctly defining the function parameter `bag`.
> - 1 point for correctly printing `Your bag contains:`.
> - 2 points for correctly using a loop to print items.
> - 2 points for correctly printing the statement and output format (items space-separated on one line).

---

### Part (c) — `put_in_bag` [4 points]

Implement `put_in_bag` that adds a given item to the bag `amount` times and returns the updated bag.

```python
def put_in_bag(bag, item, amount):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def put_in_bag(bag: list[str], item: str, amount: int) -> list[str]:
>     for _ in range(amount):
>         bag.append(item)
>     return bag
> ```
>
> **Rubric (4 points total):**
> - 0.5 points for correctly defining the function with the name `put_in_bag`.
> - 1 point for correctly defining the function parameters `bag`, `item`, `amount`.
> - 2 points for correctly using a loop to add multiple items.
> - 0.5 points for correctly returning the updated bag.

---

### Part (d) — `purchase_item` [8 points]

Implement `purchase_item` that attempts to buy an item from the store.

- If the player has **enough balance**: deduct `price * amount` and return `(new_balance, item, amount)`.
- If the player does **not have enough balance**: return `(balance, item, 0)`.

The parameter `amount` should default to `1`.

```python
def purchase_item(balance, item, price, amount=1):
    # Your code here
    pass
```

> **Solution:**
> ```python
> def purchase_item(balance: int, item: str, price: int,
>                   amount: int = 1) -> tuple[int, str, int]:
>     if balance >= price * amount:
>         balance -= price * amount
>         return balance, item, amount
>     else:
>         return balance, item, 0
> ```
>
> **Alternative (one-liner):**
> ```python
> def purchase_item(balance: int, item: str, price: int, amount: int = 1) \
>         -> tuple[int, str, int]:
>     return (balance - price * amount, item, amount) \
>         if balance >= price * amount else (balance, item, 0)
> ```
>
> **Rubric (8 points total):**
> - 0.5 points for correctly defining the function with the name `purchase_item`.
> - 1.5 points for correctly defining the function parameters `balance`, `item`, `price`, `amount`.
> - 1 point for correctly handling the default parameter value `amount = 1`.
> - 2.5 points for correctly implementing the balance deduction logic.
> - 2.5 points for correctly returning the value as a tuple with the correct structure.

---

## Problem 5 — Number Guessing Game [26 points]

**Category:** Coding

Implement a Python number guessing game where the computer generates a random integer between **1 and 100** (inclusive), and the player has up to **10 attempts** to guess it.

The game state is managed as a list:
```
[secret_number, attempts, max_attempts, low_bound, high_bound, game_over]
```

| Index | Field | Description |
|-------|-------|-------------|
| 0 | `secret_number` | The random integer to guess |
| 1 | `attempts` | Number of valid guesses made so far |
| 2 | `max_attempts` | Maximum guesses allowed (10) |
| 3 | `low_bound` | Current lowest valid guess |
| 4 | `high_bound` | Current highest valid guess |
| 5 | `game_over` | `True` if won or exhausted; else `False` |

**Rules:**
- If a guess is too low → `low_bound` becomes `guess + 1`
- If a guess is too high → `high_bound` becomes `guess - 1`
- For non-integer input → print `Invalid input! Please enter a whole number.` and re-prompt (do NOT count the attempt)
- For integers outside current valid range → print `Please enter a number between {low_bound} and {high_bound}.` and re-prompt (do NOT count the attempt)
- On correct guess → print `Congratulations! You guessed the number {secret_number} in {attempts} attempts!`
- If all 10 attempts exhausted → reveal secret number

**Pre-implemented functions (do not modify):**

```python
import random

def play_single_round() -> None:
    game_state: list[int | bool] = initialize_game()
    print("Guess the number (1-100)! You have 10 attempts.\n")
    while game_state[1] < game_state[2] and not game_state[5]:
        guess: int = get_valid_guess(game_state)
        game_state = process_guess(guess, game_state)
    if not game_state[5]:
        print(f"Game over! The secret number was {game_state[0]}.")

def main() -> None:
    print("=== Number Guessing Game ===\n")
    while True:
        play_single_round()
        play_again: str = input("\nWould you like to play again? (y/n): ")
        if play_again not in ['y', 'yes']:
            print("Thanks for playing! Goodbye!")
            break
        print("\n" + "="*30 + "\n")

if __name__ == "__main__":
    main()
```

**Sample interaction:**
```
=== Number Guessing Game ===

Guess the number (1-100)! You have 10 attempts.

Attempt 1 (Range: 1-100): abc
Invalid input! Please enter a whole number.
Attempt 1 (Range: 1-100): 4.3
Invalid input! Please enter a whole number.
Attempt 1 (Range: 1-100): 50
Too low!

Attempt 2 (Range: 51-100): 75
Too high!

Attempt 3 (Range: 51-74): 30
Please enter a number between 51 and 74.
Attempt 3 (Range: 51-74): 60
Too low!

Attempt 4 (Range: 61-74): 64
Congratulations! You guessed the number 64 in 4 attempts!

Would you like to play again? (y/n): n
Thanks for playing! Goodbye!
```

---

### Part (a) — `initialize_game` [4 points]

Implement `initialize_game()` to set up and return the initial game state list.

```python
def initialize_game() -> list[int | bool]:
    """
    Set up and return the initial state for a new game.
    Generate a random secret number and initialize all game parameters.
    """
    pass
```

> **Solution:**
> ```python
> def initialize_game() -> list[int | bool]:
>     secret_number: int = random.randint(1, 100)
>     return [secret_number, 0, 10, 1, 100, False]
> ```
>
> **Rubric (4 points total):**
> - 2 points for correctly generating a random number in the range 1–100 inclusive.
>   - Deduct 1 point for each incorrect boundary (upper or lower).
> - 2 points for correctly returning the list with all 6 game state values in the correct order.
>   - Deduct 0.5 points for each incorrect variable (max deduction: 2 points).
>   - Deduct 0.5 points for no return or incorrect order.
> - Deduct 0.25 points for each type of syntax error.

---

### Part (b) — `get_valid_guess` [11 points]

Implement `get_valid_guess(game_state)` to prompt the user for a valid guess.

- Display: `Attempt {attempts+1} (Range: {low_bound}-{high_bound}): `
- If input contains non-digit characters → print `Invalid input! Please enter a whole number.` and re-prompt.
- If input is an integer outside `[low_bound, high_bound]` → print `Please enter a number between {low_bound} and {high_bound}.` and re-prompt.
- Return only when a valid integer within the current range is provided.
- Do **not** increment the attempt counter in this function.

```python
def get_valid_guess(game_state: list[int | bool]) -> int:
    pass
```

> **Solution:**
> ```python
> def get_valid_guess(game_state: list[int | bool]) -> int:
>     while True:
>         guess_input: str = input(
>             f"Attempt {game_state[1] + 1} "
>             f"(Range: {game_state[3]}-{game_state[4]}): "
>         )
>         if not guess_input.isdigit():
>             print("Invalid input! Please enter a whole number.")
>             continue
>         guess: int = int(guess_input)
>         if guess < game_state[3] or guess > game_state[4]:
>             print(f"Please enter a number between {game_state[3]} and {game_state[4]}.")
>             continue
>         return guess
> ```
>
> **Rubric (11 points total):**
> - 1 point for correctly obtaining the user's input.
> - 1.5 points for correctly displaying the prompt text (attempt number and range).
> - 3 points for correctly checking for non-digit input, displaying the error message `Invalid input! Please enter a whole number.`, and re-prompting.
> - 1.5 points for correctly converting the guess from string to integer.
> - 3 points for correctly checking if guess is within valid range, displaying `Please enter a number between {low_bound} and {high_bound}.`, and re-prompting.
> - 1 point for correctly returning the valid guess.

---

### Part (c) — `process_guess` [11 points]

Implement `process_guess(guess, game_state)` to process the user's validated guess and update the game state.

- Increment the attempt counter.
- If correct: print `Congratulations! You guessed the number {secret_number} in {attempts} attempts!` and set `game_over = True`.
- If too high: print `Too high!` and update `high_bound = guess - 1`.
- If too low: print `Too low!` and update `low_bound = guess + 1`.
- Return the updated game state.

```python
def process_guess(guess: int, game_state: list[int | bool]) -> list[int | bool]:
    pass
```

> **Solution:**
> ```python
> def process_guess(guess: int, game_state: list[int | bool]) -> list[int | bool]:
>     game_state[1] += 1
>     if guess == game_state[0]:
>         print(f"Congratulations! You guessed the number {game_state[0]} in "
>               f"{game_state[1]} attempts!")
>         game_state[5] = True
>     elif guess > game_state[0]:
>         print("Too high!")
>         game_state[4] = guess - 1
>     else:
>         print("Too low!")
>         game_state[3] = guess + 1
>     print()
>     return game_state
> ```
>
> **Rubric (11 points total):**
> - 1 point for correctly incrementing the attempt counter by 1.
> - 1 point for correctly performing the equality test for the secret number.
> - 1.5 points for correctly displaying the congratulations message:
>   - 0.5 points for the correct string format.
>   - 0.5 points for each of the two variables (secret number and attempts) in the f-string.
> - 1 point for correctly setting `game_over` (`game_state[5]`) to `True`.
> - 1 point for correctly performing the "greater than" test for the secret number.
> - 1 point for correctly displaying `Too high!`.
> - 1 point for correctly setting `high_bound` to `guess - 1`.
> - 1 point for correctly performing the "less than" (else) branch.
> - 1 point for correctly displaying `Too low!`.
> - 1 point for correctly setting `low_bound` to `guess + 1`.
> - 0.5 points for correctly returning the updated game state list.
>
> **Common errors (0 points):**
> - Using undefined or fabricated variable names like `secret_number` without defining them.
> - Using Python built-in names (`int`, `list`) as variable names.

---

## Problem 6 — Sales of Car Accessories [16 points]

**Category:** Coding

You are given a 2D list of weekly sales data:

```python
week1_sales = [
    [12, 15, 22, 18, 21, 27, 25],
    [24, 25, 23, 16, 28, 16, 13],
    [29, 26, 28, 18, 26, 15, 14],
    [29, 21, 25, 28, 10, 15, 12],
    [22, 13, 24, 26, 15, 25, 23],
    [11, 19, 28, 18, 27, 25, 20],
    [16, 21, 22, 13, 23, 24, 27]
]

product_names = [
    "Car Paint",
    "Baby Car Seats",
    "EV Charging Cable",
    "Driving Recorder",
    "USB Car Charger",
    "Headrest",
    "'Baby in Car' Sticker"
]
```

> ⚠️ **Important constraints for ALL parts (a)–(c):**
> - Each function body must use **only ONE statement**.
> - Partial points will be deducted for using more than one statement, even if correct.
> - You **must NOT** use lambda functions or semi-colons.
> - Deduct 2 points if the list is modified in-place instead of returning a new list.
> - Score is capped at 4 for part (a), 3 for parts (b) and (c) if more than one line is used.
> - Score is capped at 2 if more than 2 looping statements (excluding comprehension loops) are used.
> - Deduct 0.5 points if return statement is missing.
> - **0 points if lambda functions or semi-colons are used.**

---

### Part (a) — `transpose` [6 points]

Implement `transpose(sales_list)` that returns a **transposed copy** of `sales_list` using only **ONE statement**.

Transposing means interchanging rows and columns: the first row becomes the first column, etc.

**Example:**
- `transpose([[1, 2, 3], [4, 5, 6]])` → `[[1, 4], [2, 5], [3, 6]]`

**Hint:** Use a nested list comprehension. Outer loop iterates over column indices; inner loop collects elements from each row.

```python
def transpose(sales_list: list[list[int]]) -> list[list[int]]:
    # ONE statement only
    pass
```

> **Solution:**
> ```python
> def transpose(sales_list: list[list[int]]) -> list[list[int]]:
>     return [
>         [row[i] for row in sales_list]
>         for i in range(len(sales_list[0]))
>     ]
> ```
>
> **Alternative:**
> ```python
> def transpose(sales_list: list[list[int]]) -> list[list[int]]:
>     return [
>         [sales_list[j][i] for j in range(len(sales_list))]
>         for i in range(len(sales_list[0]))
>     ]
> ```
>
> **Rubric (6 points total):**
> - 1 point for getting the number of columns via `len(sales_list[0])`.
> - 1 point for correctly iterating through columns in the outer comprehension (`for i in range(len(sales_list[0]))`).
> - 1 point for getting the number of rows via `len(sales_list)` (automatically awarded if iterating through rows directly).
> - 1 point for correctly iterating through `sales_list` in the inner comprehension.
> - 2 points for correctly getting column values via `row[i]` or `sales_list[j][i]`.

---

### Part (b) — `shift` [5 points]

Implement `shift(sales_list, days)` that returns a copy of `sales_list` with columns shifted **LEFT** by `days` using only **ONE statement**. No lambda functions or semi-colons.

**Examples:**
- `shift([[1, 2, 3], [4, 5, 6]], 1)` → `[[2, 3, 1], [5, 6, 4]]`
- `shift([[1, 2, 3], [4, 5, 6]], 2)` → `[[3, 1, 2], [6, 4, 5]]`

**Hint:** Use list comprehension and slicing to shift each row.

```python
def shift(sales_list: list[list[int]], days: int) -> list[list[int]]:
    # ONE statement only
    pass
```

> **Solution:**
> ```python
> def shift(sales_list: list[list[int]], days: int) -> list[list[int]]:
>     return [
>         row[days % len(row):] + row[:days % len(row)]
>         for row in sales_list
>     ]
> ```
>
> **Rubric (5 points total):**
> - 1 point for realizing `days` could be larger than `len(row)` (handling modulo).
> - 1 point for using `%` to keep the shift value in range `[1, len(row))` — also handles negative `days`. Note: No points if a literal (e.g., `7`) is used instead of `len(row)`.
> - 0.75 points for getting elements from index `days` to `len(row)` via slicing.
> - 0.75 points for getting elements from index `0` to `days` via slicing.
> - 1 point for getting number of columns via `len(row)` or `len(sales_list[0])` (automatically given if iterating rows directly).
> - 0.5 points for correctly iterating through `sales_list` via list comprehension.

---

### Part (c) — `shift_right` [5 points]

Implement `shift_right(sales_list, days)` that does the same as `shift()` except columns are shifted **RIGHT** by `days`. Use only **ONE statement**. You **must NOT** use any loops or list comprehension.

**Examples:**
- `shift_right([[1, 2, 3], [4, 5, 6]], 1)` → `[[3, 1, 2], [6, 4, 5]]`
- `shift_right([[1, 2, 3], [4, 5, 6]], 2)` → `[[2, 3, 1], [5, 6, 4]]`

**Hint:** Use the `shift` function from part (b).

```python
def shift_right(sales_list: list[list[int]], days: int) -> list[list[int]]:
    # ONE statement only, no loops or list comprehension
    pass
```

> **Solution:**
> ```python
> def shift_right(sales_list: list[list[int]], days: int) -> list[list[int]]:
>     return shift(sales_list, -(days % len(sales_list[0])))
> ```
>
> **Alternative:**
> ```python
> def shift_right(sales_list: list[list[int]], days: int) -> list[list[int]]:
>     return shift(sales_list, len(sales_list[0]) - (days % len(sales_list[0])))
> ```
>
> **Rubric (5 points total):**
> - 1 point for passing `sales_list` into `shift()`.
> - 2 points for `shift` being a tail call (the statement must be `return shift(...)`).
> - 1 point for realizing `days` could be larger than `len(row)` (automatically given if handled in part (b) already).
> - If using negation (`-days`):
>   - 1 point given **only if** part (b) already handled negative `days`.
> - Otherwise:
>   - 1 point for computing `len(sales_list[0]) - (days % len(sales_list[0]))` as the second argument.

---

*— END OF PAPER —*