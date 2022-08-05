import re

from Crypto.Hash import SHAKE128  # type: ignore


def hash_func(data: str):
    shake = SHAKE128.new()
    shake.update(str.encode(data))
    return shake.read(SHAKE_128_OUTPUT_BYTES).hex()


def to_kebab_case(camel_case: str):
    return re.sub(r"(?<!^)(?=[A-Z])", "-", camel_case).lower()


# 1 byte = 8 bits
# 1 byte = 2 hex digits
SHAKE_128_OUTPUT_BITS = 64
SHAKE_128_OUTPUT_BYTES = 8
HASH_LENGTH = int(SHAKE_128_OUTPUT_BITS / 4)

ASCII_START_ZERO = 48
ASCII_START_TEN = 65
ASCII_START_THIRTY_SIX = 97


class VersionOutOfRange(Exception):
    pass


def is_supported_version(char_code: int):
    return (
        (char_code >= ASCII_START_ZERO and char_code <= ASCII_START_ZERO + 9)
        or (char_code >= ASCII_START_TEN and char_code <= ASCII_START_TEN + 25)
        or (
            char_code >= ASCII_START_THIRTY_SIX
            and char_code <= ASCII_START_THIRTY_SIX + 25
        )
    )


def version_from_char(char: str) -> int:
    char_code = ord(char)
    if char_code >= ASCII_START_ZERO and char_code <= ASCII_START_ZERO + 9:
        return char_code - ASCII_START_ZERO
    elif char_code >= ASCII_START_TEN and char_code <= ASCII_START_TEN + 25:
        return char_code - ASCII_START_TEN + 10
    elif (
        char_code >= ASCII_START_THIRTY_SIX and char_code <= ASCII_START_THIRTY_SIX + 25
    ):
        return char_code - ASCII_START_THIRTY_SIX + 36
    else:
        raise VersionOutOfRange("Unsupported version character {v}")


def number_to_version_char(v: int) -> str:
    """inverse of version_from_char()"""
    if v >= 0 and v <= 9:
        return chr(v + ASCII_START_ZERO)
    elif v >= 10 and v <= 10 + 25:
        return chr(v + ASCII_START_TEN - 10)
    elif v >= 36 and v <= 36 + 25:
        return chr(v + ASCII_START_THIRTY_SIX - 36)
    else:
        raise VersionOutOfRange(f"version out of supported range: {v}")
