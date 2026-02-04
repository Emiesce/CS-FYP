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
        "scoreDistribution": None
    }
  
  return {
    "averageScore": float(arr.mean()),
    "q1Score": float(np.percentile(arr, 25)),
    "medianScore": float(np.median(arr)),
    "q3Score": float(np.percentile(arr, 75)),
    "stdDeviation": float(arr.std(ddof=1)),
    "minScore": float(arr.min()),
    "maxScore": float(arr.max()),
    "scoreDistribution": np.histogram(arr, bins=num_bins, range=(0.0, 1.0))[0].tolist() # get the counts only, [1] is the bin edges
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