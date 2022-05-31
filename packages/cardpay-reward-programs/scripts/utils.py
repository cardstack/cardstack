#!/usr/bin/env python3
from enum import Enum

from hexbytes import HexBytes

NULL_HEX = HexBytes(
    "0x0000000000000000000000000000000000000000000000000000000000000000"
)

EMPTY_MARKER_HEX = HexBytes(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
)


class Environment(str, Enum):
    staging = "staging"
    production = "production"
