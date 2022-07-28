import re


def is_hex_string(s):
    pattern = "0x([0-9a-fA-F]+)$"
    return bool(re.match(pattern, s))


def validate_proof_response_fields(res):
    for o in res:
        for s in o["proofArray"]:
            assert is_hex_string(s)
        assert is_hex_string(o["rootHash"])
        assert is_hex_string(o["leaf"])
        assert is_hex_string(o["payee"])
        assert is_hex_string(o["tokenAddress"])


def check_duplicates_for_roots(models):
    payment_cycles = set()
    roots = set()
    for root in models:
        payment_cycles.add(root.paymentCycle)
        roots.add(root.rootHash)
    assert len(models) == len(roots)
    assert len(models) == len(payment_cycles)


def check_duplicates_for_proofs(res):
    leafs = set()
    for proof in res:
        leafs.add(proof["leaf"])
    assert len(res) == len(leafs)
