with open("app/services/analytics/__init__.py", "r") as f:
    code = f.read()

code = code.replace("cached = _proctoring_store.get(exam_id, {})\n    if cached or db is None:\n        return cached", "if db is None:\n        return _proctoring_store.get(exam_id, {})")

with open("app/services/analytics/__init__.py", "w") as f:
    f.write(code)
