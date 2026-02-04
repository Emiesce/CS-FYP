import sqlite3

# dummy data to test workflow

GRADES = [
    # ---------- Q1 (T1: Heat) ----------
    ("S1", "EXAM1", "Q1", "T1", 0, 2, "Confused heat with temperature"),
    ("S2", "EXAM1", "Q1", "T1", 0, 2, "Mistook heat for temperature"),
    ("S3", "EXAM1", "Q1", "T1", 2, 2, ""),
    ("S4", "EXAM1", "Q1", "T1", 0, 2, "Used incorrect definition of heat"),
    ("S5", "EXAM1", "Q1", "T1", 2, 2, ""),

    # ---------- Q2 (T1: Heat) ----------
    ("S1", "EXAM1", "Q2", "T1", 1, 2, "Partial understanding of heat transfer"),
    ("S2", "EXAM1", "Q2", "T1", 0, 2, "Applied wrong formula"),
    ("S3", "EXAM1", "Q2", "T1", 2, 2, ""),
    ("S4", "EXAM1", "Q2", "T1", 1, 2, "Mixed heat and temperature concepts"),
    ("S5", "EXAM1", "Q2", "T1", 2, 2, ""),

    # ---------- Q3 (T2: Temperature) ----------
    ("S1", "EXAM1", "Q3", "T2", 0, 1, "Incorrect unit conversion"),
    ("S2", "EXAM1", "Q3", "T2", 1, 1, ""),
    ("S3", "EXAM1", "Q3", "T2", 0, 1, "Used wrong temperature unit"),
    ("S4", "EXAM1", "Q3", "T2", 1, 1, ""),
    ("S5", "EXAM1", "Q3", "T2", 1, 1, ""),

    # ---------- Q4 (T3: Energy) ----------
    ("S1", "EXAM1", "Q4", "T3", 1, 2, "Correct idea but incorrect calculation"),
    ("S2", "EXAM1", "Q4", "T3", 0, 2, "Misunderstood kinetic energy formula"),
    ("S3", "EXAM1", "Q4", "T3", 2, 2, ""),
    ("S4", "EXAM1", "Q4", "T3", 0, 2, "Used wrong energy equation"),
    ("S5", "EXAM1", "Q4", "T3", 2, 2, ""),

    # ---------- Q5 (T3: Energy) ----------
    ("S1", "EXAM1", "Q5", "T3", 0, 2, "Confused potential and kinetic energy"),
    ("S2", "EXAM1", "Q5", "T3", 1, 2, "Partial understanding of energy conservation"),
    ("S3", "EXAM1", "Q5", "T3", 2, 2, ""),
    ("S4", "EXAM1", "Q5", "T3", 1, 2, "Forgot to include gravitational potential"),
    ("S5", "EXAM1", "Q5", "T3", 2, 2, ""),

    # ---------- Q6 (T4: Thermodynamics) ----------
    ("S1", "EXAM1", "Q6", "T4", 0, 2, "Misapplied first law of thermodynamics"),
    ("S2", "EXAM1", "Q6", "T4", 1, 2, "Correct equation but wrong sign convention"),
    ("S3", "EXAM1", "Q6", "T4", 2, 2, ""),
    ("S4", "EXAM1", "Q6", "T4", 0, 2, "Did not account for work done"),
    ("S5", "EXAM1", "Q6", "T4", 2, 2, ""),

    # ---------- Q7 (T5: Units) ----------
    ("S1", "EXAM1", "Q7", "T5", 0, 1, "Incorrect unit conversion"),
    ("S2", "EXAM1", "Q7", "T5", 1, 1, ""),
    ("S3", "EXAM1", "Q7", "T5", 0, 1, "Forgot to convert joules to kilojoules"),
    ("S4", "EXAM1", "Q7", "T5", 1, 1, ""),
    ("S5", "EXAM1", "Q7", "T5", 1, 1, ""),

    # ---------- Q8 (T5: Units) ----------
    ("S1", "EXAM1", "Q8", "T5", 1, 1, ""),
    ("S2", "EXAM1", "Q8", "T5", 0, 1, "Used incorrect unit prefix"),
    ("S3", "EXAM1", "Q8", "T5", 1, 1, ""),
    ("S4", "EXAM1", "Q8", "T5", 0, 1, "Mistook milli for micro"),
    ("S5", "EXAM1", "Q8", "T5", 1, 1, ""),
]

conn = sqlite3.connect("test_analytics.db")
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS grades (
    studentId TEXT,
    examId TEXT,
    questionId TEXT,
    topicId TEXT,
    score REAL,
    maxScore REAL,
    feedback TEXT
)
""")

cur.executemany(
    "INSERT INTO grades VALUES (?, ?, ?, ?, ?, ?, ?)",
    GRADES
)

conn.commit()
conn.close()

print("Test DB created: test_analytics.db")
