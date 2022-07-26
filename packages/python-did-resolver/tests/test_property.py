import re
from datetime import timedelta
from typing import get_args

import pytest
from did_resolver.resolver import Resolver
from hypothesis import given, settings
from hypothesis import strategies as st
from python_did_resolver.main import (
    FLICKR_BASE58_ALPHABET,
    SHORT_TYPE,
    CardstackIdentifierType,
    encode_did,
    hash_func,
    is_flickr_base_58,
    is_valid_uuid,
    parse_identifier,
    s3_resolution_method,
    su,
)
from python_did_resolver.utils import VersionOutOfRange, to_kebab_case

from .call_js_resolver import js_encode_did, js_parse_identifier, js_resolve_did

encode_options = st.fixed_dictionaries(
    {
        "type": st.sampled_from(
            [
                "PrepaidCardCustomization",
                "MerchantInfo",
                "SupplierInfo",
                "CardSpace",
                "RewardRule",
            ]
        ),
    },
    optional={
        "version": st.integers(min_value=1, max_value=61),
        "uniqueId": st.uuids().map(lambda uuid: su.encode(uuid)),
    },
)

encode_options_bad_unique_id = st.fixed_dictionaries(
    {
        "type": st.sampled_from(
            [
                "PrepaidCardCustomization",
                "MerchantInfo",
                "SupplierInfo",
                "CardSpace",
                "RewardRule",
            ]
        ),
        "uniqueId": st.sampled_from(["foo"]),
    },
    optional={"version": st.integers(min_value=1, max_value=61)},
)
encode_options_bad_version = st.fixed_dictionaries(
    {
        "type": st.sampled_from(
            [
                "PrepaidCardCustomization",
                "MerchantInfo",
                "SupplierInfo",
                "CardSpace",
                "RewardRule",
            ]
        ),
        "version": st.one_of(st.integers(max_value=-1), st.integers(min_value=62)),
    },
    optional={
        "uniqueId": st.uuids().map(lambda uuid: su.encode(uuid)),
    },
)


@given(st.uuids())
def test_shortuuid(o):
    """
    This test ensures that the shortuuid class is patched correctly
    """
    assert su._alphabet == list(FLICKR_BASE58_ALPHABET)
    o == su.decode(su.encode(o))


@given(encode_options)
@settings(deadline=timedelta(seconds=60))
def test_encode(o):
    did = encode_did(o)
    assert isinstance(did, str)
    assert bool(re.match("^did:cardstack:", did))
    identifier = did.split(":")[2]
    parsed = parse_identifier(identifier)
    assert isinstance(parsed.uniqueId, str)
    assert is_valid_uuid(str(su.decode(parsed.uniqueId)), version=4) or is_valid_uuid(
        str(su.decode(parsed.uniqueId)), version=5
    )
    assert is_flickr_base_58(parsed.uniqueId)
    assert parsed.type in get_args(CardstackIdentifierType)  # runtime check


@given(encode_options)
@settings(deadline=timedelta(seconds=60))
def test_encode_js(o):
    did = js_encode_did(o)
    assert isinstance(did, str)
    assert bool(re.match("^did:cardstack:", did))
    identifier = did.split(":")[2]
    parsed = js_parse_identifier(identifier)
    assert isinstance(parsed.uniqueId, str)
    assert is_valid_uuid(str(su.decode(parsed.uniqueId)), version=4) or is_valid_uuid(
        str(su.decode(parsed.uniqueId)), version=5
    )
    assert is_flickr_base_58(parsed.uniqueId)
    assert parsed.type in get_args(CardstackIdentifierType)  # runtime check


@given(encode_options_bad_unique_id)
def test_encode_bad_unique_id(o):
    with pytest.raises(
        Exception,
        match=r"uniqueId must be a flickrBase58 or RFC4122 v4-compliant UUID. Was: .*",
    ):
        encode_did(o)


@given(encode_options_bad_version)
@settings(deadline=timedelta(seconds=60))
def test_encode_bad_version(o):
    with pytest.raises(VersionOutOfRange):
        encode_did(o)


@given(encode_options)
@settings(deadline=timedelta(seconds=60))
def test_compat_encode(o):
    did = encode_did(o)
    did_js = js_encode_did(o)
    did == did_js


@given(encode_options)
def test_resolve(o):
    did = encode_did(o)
    path = to_kebab_case(o["type"])
    registry = {"cardstack": s3_resolution_method}
    r = Resolver(registry)
    resolved_doc = r.resolve(did)
    if "alsoKnownAs" in resolved_doc["didDocument"].keys() and "unique_id" in o.keys():
        uid = o["unique_id"]
        assert (
            resolved_doc["didDocument"]["alsoKnownAs"][0]
            == f"https://storage.cardstack.com/{path}/{uid}.json"
        )


@given(encode_options)
def test_resolve_invalid_checksum(o):
    did = encode_did(o) + "a"
    registry = {"cardstack": s3_resolution_method}
    r = Resolver(registry)
    with pytest.raises(
        Exception,
        match=r"Invalid DID identifier: checksum failed",
    ):
        r.resolve(did)


SHORT_TYPES_DELIMITED = "".join([str(ele) + "|" for ele in get_args(SHORT_TYPE)])
REGEX_NON_EXISTENT_SHORT_CODE = rf"^(?!(?:{SHORT_TYPES_DELIMITED})$)[a-z]\Z"


@given(st.from_regex(REGEX_NON_EXISTENT_SHORT_CODE))
def test_resolve_invalid_short_type(c):
    cardstack_identifier = "1" + c + su.random(length=22)
    did = f"did:cardstack:{cardstack_identifier}{hash_func(cardstack_identifier)}"
    registry = {"cardstack": s3_resolution_method}
    r = Resolver(registry)
    with pytest.raises(
        Exception,
        match=r"Invalid DID identifier: unknown type .*",
    ):
        r.resolve(did)


@given(encode_options)
@settings(deadline=timedelta(seconds=60))
def test_resolve_js(o):
    did = js_encode_did(o)
    path = to_kebab_case(o["type"])
    resolved_doc = js_resolve_did(did)
    if "alsoKnownAs" in resolved_doc["didDocument"].keys() and "unique_id" in o.keys():
        uid = o["unique_id"]
        assert (
            resolved_doc["didDocument"]["alsoKnownAs"][0]
            == f"https://storage.cardstack.com/{path}/{uid}.json"
        )


@given(encode_options)
@settings(deadline=timedelta(seconds=60))
def test_compat_resolve(o):
    did = encode_did(o)
    registry = {"cardstack": s3_resolution_method}
    r = Resolver(registry)
    r.resolve(did) == js_resolve_did(did)
