import math

import numpy as np
import pytest

from services.utils import (
    classify_topic_performance,
    classify_z_score,
    compute_class_statistics,
)


def test_compute_class_statistics_empty_returns_nones_and_empty_cards():
    result = compute_class_statistics([])

    assert result["averageScore"] is None
    assert result["q1Score"] is None
    assert result["medianScore"] is None
    assert result["q3Score"] is None
    assert result["stdDeviation"] is None
    assert result["minScore"] is None
    assert result["maxScore"] is None
    assert result["scoreDistribution"] is None
    assert result["cards"] == []


def test_compute_class_statistics_basic_values_and_histogram_binning():
    percentages = [0.0, 0.5, 1.0]
    result = compute_class_statistics(percentages, num_bins=10)

    assert result["averageScore"] == 0.5
    assert result["q1Score"] == 0.25
    assert result["medianScore"] == 0.5
    assert result["q3Score"] == 0.75
    assert result["stdDeviation"] == 0.5
    assert result["minScore"] == 0.0
    assert result["maxScore"] == 1.0

    # 10 bins on [0, 1]. 0 -> bin0, 0.5 -> bin5, 1.0 -> last bin.
    assert result["scoreDistribution"] == [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]

    assert [c["title"] for c in result["cards"]] == [
        "Average Score",
        "Q1 Score",
        "Median Score",
        "Q3 Score",
        "Std. Deviation",
        "Minimum Score",
        "Maximum Score",
    ]
    assert [c["value"] for c in result["cards"]] == [
        result["averageScore"],
        result["q1Score"],
        result["medianScore"],
        result["q3Score"],
        result["stdDeviation"],
        result["minScore"],
        result["maxScore"],
    ]


def test_compute_class_statistics_single_value_has_nan_sample_stddev():
    result = compute_class_statistics([0.2], num_bins=10)

    assert result["averageScore"] == 0.2
    assert result["q1Score"] == 0.2
    assert result["medianScore"] == 0.2
    assert result["q3Score"] == 0.2
    assert math.isnan(result["stdDeviation"])
    assert result["minScore"] == 0.2
    assert result["maxScore"] == 0.2

    # Sanity check: distribution length matches bins, and total count matches N.
    assert len(result["scoreDistribution"]) == 10
    assert sum(result["scoreDistribution"]) == 1

    # Match numpy's binning behavior precisely.
    expected_counts, _ = np.histogram(np.array([0.2], dtype=float), bins=10, range=(0.0, 1.0))
    assert result["scoreDistribution"] == expected_counts.tolist()


@pytest.mark.parametrize(
    "delta, expected",
    [
        (0.1, "Strong"),
        (0.1000001, "Strong"),
        (-0.1, "Needs improvement"),
        (-0.1000001, "Needs improvement"),
        (0.0, "On par"),
        (0.099, "On par"),
        (-0.099, "On par"),
    ],
)
def test_classify_topic_performance_thresholds(delta, expected):
    assert classify_topic_performance(delta) == expected


@pytest.mark.parametrize(
    "z, expected",
    [
        (1.0, "Above average"),
        (1.00001, "Above average"),
        (-1.0, "Below average"),
        (-1.00001, "Below average"),
        (0.0, "Average"),
        (0.999, "Average"),
        (-0.999, "Average"),
    ],
)
def test_classify_z_score_thresholds(z, expected):
    assert classify_z_score(z) == expected
