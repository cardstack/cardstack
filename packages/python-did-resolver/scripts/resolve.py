import json
import uuid as _uu
from uuid import UUID

import requests
from did_resolver import Resolver
from python_did_resolver.main import (
    UUIDV5_NAMESPACE,
    EncodeOptions,
    encode_did,
    get_resolver,
    su,
)


def resolve_doc(did: str):
    try:
        url = Resolver(get_resolver()).resolve(did)["didDocument"]["alsoKnownAs"][0]
        return requests.get(url).json()
    except Exception as e:
        raise e


def validate(did: str):
    """
    Validate "did" corresponds to content of file
    """
    content = resolve_doc(reward_rule_did)
    json_content = json.dumps(content)
    _uu.NAMESPACE_DNS = UUID(UUIDV5_NAMESPACE)
    uid = su.uuid(name=json_content)
    encode_options: EncodeOptions = {
        "version": 1,
        "type": "RewardRule",
        "uniqueId": uid,
    }
    computed_did = encode_did(encode_options)
    return did == computed_did


reward_rule_did = "did:cardstack:1rqspLvwQ2qsuXRJcVzCj49j3540d207ca4116ec"
print(resolve_doc(reward_rule_did))
print(validate(reward_rule_did))
