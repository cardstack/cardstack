#!/usr/bin/env python3

import re
from typing import Literal, TypedDict
from uuid import UUID

from did_resolver import DIDDocument, DIDResolutionResult, ParsedDID, Resolvable
from shortuuid import ShortUUID
from typing_extensions import NotRequired

from .utils import HASH_LENGTH, hash_func, number_to_version_char, to_kebab_case

# https://github.com/skorokithakis/shortuuid/issues/68
# shortuuid decode() sorts alphabets before using it for translation
# this is incompatible with shortuuid implementation in javascript
# we therefore overwrite the _alphabet attribute so the answers are the same in javascript
FLICKR_BASE58_ALPHABET = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
su = ShortUUID(alphabet=FLICKR_BASE58_ALPHABET)
su._alphabet = list(FLICKR_BASE58_ALPHABET)

UUIDV5_NAMESPACE = (
    "1b671a64-40d5-491e-99b0-da01ff1f3341"  # this NAMESPACE is reserved for uuid5
)
CURRENT_VERSION = 1
CardstackIdentifierType = Literal[
    "PrepaidCardCustomization",
    "MerchantInfo",
    "SupplierInfo",
    "CardSpace",
    "RewardRule",
]
SHORT_TYPE = Literal["p", "m", "s", "c", "r"]


def did_type_to_short_type(cardstack_identifier: CardstackIdentifierType) -> SHORT_TYPE:
    if cardstack_identifier == "PrepaidCardCustomization":
        return "p"
    elif cardstack_identifier == "MerchantInfo":
        return "m"
    elif cardstack_identifier == "SupplierInfo":
        return "s"
    elif cardstack_identifier == "CardSpace":
        return "c"
    elif cardstack_identifier == "RewardRule":
        return "r"


def short_type_to_did_type(short_type: str) -> CardstackIdentifierType:
    """inverse of did_type_to_short_type()"""
    if short_type == "p":
        return "PrepaidCardCustomization"
    elif short_type == "m":
        return "MerchantInfo"
    elif short_type == "s":
        return "SupplierInfo"
    elif short_type == "c":
        return "CardSpace"
    elif short_type == "r":
        return "RewardRule"
    else:
        raise Exception(f'Invalid DID identifier: unknown type "{short_type}"')


class CardstackIdentifier:
    version: int
    type: CardstackIdentifierType
    uniqueId: str

    def __init__(
        self, version: int, type: CardstackIdentifierType, unique_id: str
    ) -> None:
        self.version = version
        self.type = type
        self.uniqueId = normalize_unique_id(unique_id)

    def to_did(self):
        version_string = number_to_version_char(self.version)
        result = f"{version_string}{did_type_to_short_type(self.type)}{self.uniqueId}"
        checksum = hash_func(result)
        return f"did:cardstack:{result}{checksum}"

    def __repr__(self):
        return f"""{self.__class__.__name__}(version: {self.version}, type: {self.type}, unique_id: {self.uniqueId})"""


def normalize_unique_id(candidate: str):
    if is_flickr_base_58(candidate):
        return candidate
    else:
        if is_valid_uuid(candidate):
            return su.encode(candidate)
        else:
            raise Exception(
                f'uniqueId must be a flickrBase58 or RFC4122 v4-compliant UUID. Was: "{candidate}"'
            )


def is_valid_uuid(uuid_to_test, version=4):
    try:
        UUID(uuid_to_test, version=version)
        return True
    except ValueError:
        return False


def is_flickr_base_58(candidate: str) -> bool:
    BASE_58_CHAR_LENGTH = 22
    return len(candidate) == BASE_58_CHAR_LENGTH and bool(
        re.match(f"^[{FLICKR_BASE58_ALPHABET}]+$", candidate)
    )


def s3_resolution_method(
    did: str, parsed_did: ParsedDID, resolver: Resolvable
) -> DIDResolutionResult:
    cardstack_identifier = parse_identifier(parsed_did["id"])
    path = to_kebab_case(cardstack_identifier.type)
    did_document: DIDDocument = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-0.0.jsonld",
        ],
        "id": did,
        "alsoKnownAs": [
            f"https://storage.cardstack.com/{path}/{cardstack_identifier.uniqueId}.json"
        ],
        "verificationMethod": [],
        "authentication": [],
        "assertionMethod": [],
    }
    return {
        "didResolutionMetadata": {"contentType": "application/did+ld+json"},
        "didDocument": did_document,
        "didDocumentMetadata": {},
    }


def parse_identifier(identifier: str) -> CardstackIdentifier:
    cutoff = len(identifier) - HASH_LENGTH
    data = identifier[:cutoff]
    checksum = identifier[cutoff : len(identifier)]
    if checksum != hash_func(data):
        raise Exception("Invalid DID identifier: checksum failed")
    version = data[0]
    type = short_type_to_did_type(data[1])
    unique_id = data[2:]
    return CardstackIdentifier(version, type, unique_id)


class EncodeOptions(TypedDict):
    type: CardstackIdentifierType
    version: NotRequired[int]
    uniqueId: NotRequired[str]


def encode_did(opts: EncodeOptions) -> str:
    version = opts.get("version", CURRENT_VERSION)
    unique_id = opts.get("uniqueId", su.uuid())
    return CardstackIdentifier(version, opts["type"], unique_id).to_did()
