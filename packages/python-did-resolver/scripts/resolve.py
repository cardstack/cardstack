import json
import uuid as _uu
from uuid import UUID

import requests
import shortuuid
from did_resolver import Resolver
from python_did_resolver.main import EncodeOptions, encode_did, s3_resolution_method


def get_resolver():
    return {"cardstack": s3_resolution_method}


def resolve_doc(did: str):
    try:
        url = Resolver(get_resolver()).resolve(did)["didDocument"]["alsoKnownAs"][0]
        return requests.get(url).json()
    except Exception as e:
        raise e


NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341"

# https://github.com/skorokithakis/shortuuid/issues/68
# shortuuid decode() sorts alphabets before using it for translation
# this is incompatible with shortuuid implementation in javascript
# we therefore overwrite the _alphabet attribute so the answers are the same in javascript
FLICKR_BASE58_ALPHABET = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
su = shortuuid.ShortUUID(alphabet=FLICKR_BASE58_ALPHABET)
su._alphabet = list(FLICKR_BASE58_ALPHABET)


def validate(did: str):
    """
    Validate "did" corresponds to content of file
    """
    content = resolve_doc(reward_rule_did)
    json_content = json.dumps(content)
    _uu.NAMESPACE_DNS = UUID(NAMESPACE)
    uid = su.uuid(name=json_content)
    encode_options: EncodeOptions = {
        "version": 1,
        "type": "RewardRule",
        "uniqueId": uid,
    }
    computed_did = encode_did(encode_options)
    return did == computed_did


reward_rule_did = "did:cardstack:1r9G5U5ndRuS6sF71mZ99huhfea3dc0deddf87da"
print(resolve_doc(reward_rule_did))
print(validate(reward_rule_did))
