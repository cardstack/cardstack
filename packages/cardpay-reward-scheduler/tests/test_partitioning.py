from hypothesis import given
from hypothesis.strategies import integers, lists, sampled_from

from reward_scheduler.utils import get_partition_iterator


def convert_to_partition_sizes(partition_size_scales):
    # Partitions must divide neatly into each other. Construct a valid set
    # by starting with the multiples. One way of picturing this is that
    # [3600, 24, 7] would be equivalent to saying "hours, days, weeks"
    partition_sizes = [partition_size_scales[0]]
    for partition_scale in partition_size_scales[1:]:
        partition_sizes.append(partition_sizes[-1] * partition_scale)
    return partition_sizes


@given(
    integers(min_value=0, max_value=1000),
    integers(min_value=0, max_value=1000),
    lists(integers(min_value=1, max_value=100), min_size=1).map(
        convert_to_partition_sizes
    ),
)
def test_partitions(start, end, partition_sizes):
    if end < start:
        start, end = end, start
    partitions = list(get_partition_iterator(start, end, partition_sizes))
    assert len(partitions) >= 0


@given(
    integers(min_value=0, max_value=1000),
    integers(min_value=0, max_value=1000),
    lists(integers(min_value=1, max_value=100), min_size=1).map(
        convert_to_partition_sizes
    ),
)
def test_no_gaps_in_partitions(start, end, partition_sizes):
    # Make sure the start is less than the end without throwing away the sample
    if end < start:
        start, end = end, start

    partitions = list(get_partition_iterator(start, end, partition_sizes))
    for partition, next_partition in zip(partitions, partitions[1:]):
        assert partition[2] == next_partition[1]


@given(
    integers(min_value=0, max_value=1000),
    integers(min_value=0, max_value=1000),
    lists(integers(min_value=1, max_value=100), min_size=1).map(
        convert_to_partition_sizes
    ),
)
def test_monotonically_decreasing_partition_sizes(start, end, partition_sizes):
    if end < start:
        start, end = end, start
    partitions = list(get_partition_iterator(start, end, partition_sizes))
    for partition, next_partition in zip(partitions, partitions[1:]):
        # The partition size should always either be the same as the one before or smaller
        # because we want _always_ to go from largest to smallest
        assert partition[0] >= next_partition[0]
