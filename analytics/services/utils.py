# all functions for basic statistical analysis

import numpy as np
import math

def compute_class_statistics(percentages, num_bins=10):
    arr = np.array(percentages, dtype=float)

    if arr.size == 0:
        return {
            "averageScore": None,
            "q1Score": None,
            "medianScore": None,
            "q3Score": None,
            "stdDeviation": None,
            "minScore": None,
            "maxScore": None,
            "scoreDistribution": None,
            "cards": []
        }

    avg = round(float(arr.mean()), 2)
    q1 = round(float(np.percentile(arr, 25)), 2)
    median = round(float(np.median(arr)), 2)
    q3 = round(float(np.percentile(arr, 75)), 2)
    std_dev = round(float(arr.std(ddof=1)), 2)
    min_score = round(float(arr.min()), 2)
    max_score = round(float(arr.max()), 2)

    # Histogram: counts only, converted to list for JSON
    counts, _ = np.histogram(arr, bins=num_bins, range=(0.0, 1.0))
    score_distribution = counts.tolist()

    return {
        "averageScore": avg,
        "q1Score": q1,
        "medianScore": median,
        "q3Score": q3,
        "stdDeviation": std_dev,
        "minScore": min_score,
        "maxScore": max_score,
        "scoreDistribution": score_distribution,
        "cards": [
            {
                "title": "Average Score",
                "value": avg,
                "description": "Class average"
            },
            {
                "title": "Q1 Score",
                "value": q1,
                "description": "Needs improvement"
            },
            {
                "title": "Median Score",
                "value": median,
                "description": "Middle performer"
            },
            {
                "title": "Q3 Score",
                "value": q3,
                "description": "Excellent performance"
            },
            {
                "title": "Std. Deviation",
                "value": std_dev,
                "description": "Class performance variability"
            },
            {
                "title": "Minimum Score",
                "value": min_score,
                "description": "Class performance at the minimum"
            },
            {
                "title": "Maximum Score",
                "value": max_score,
                "description": "Class performance at the maximum"
            },
        ]
    }


def classify_topic_performance(delta):
    if delta >= 0.1:
        return "Strong"
    elif delta <= -0.1:
        return "Needs improvement"
    else:
        return "On par"

def classify_z_score(z):
    if z >= 1.0:
        return "Above average"
    elif z <= -1.0:
        return "Below average"
    else:
        return "Average"