import json
import subprocess
import tempfile
from pathlib import Path

from python_did_resolver.main import CardstackIdentifier

js_did_resolver_path = Path("../../packages/did-resolver").resolve()


def command(js_code):
    prefix = f"const o = require('{js_did_resolver_path}');"
    return [
        "node",
        "-r",
        "ts-node/register/transpile-only",
        "-e",
        prefix + js_code,
    ]


def run(js_code: str):
    try:
        x = subprocess.check_output(
            command(js_code), cwd=js_did_resolver_path, stderr=subprocess.STDOUT
        )
        o = json.loads(x)
        return o
    except subprocess.CalledProcessError as exc:
        print("Status : FAIL", exc.returncode, exc.output)


def js_resolve_did(did: str):
    res = run(
        f"""
        const {{ Resolver }} = require(\'did-resolver\');
        (async()=>{{
            const resolver = new Resolver({{
                ...o.getResolver(),
            }});
            did = o.encodeDID({{ type: \'PrepaidCardCustomization\'}})
            const a = await resolver.resolve(\"{did}\")
            console.log(JSON.stringify(a))
            }})();
        """,
    )
    return res


def js_encode_did(encode_options):
    tfile = tempfile.NamedTemporaryFile()
    with open(tfile.name, "w") as f:
        json.dump(encode_options, f)
    res = run(
        f"""
        const fs = require("fs")
        fs.readFile("{tfile.name}", "utf8",(err,data)=>{{
            let encodeOptions = JSON.parse(data)
            console.log(JSON.stringify(o.encodeDID(encodeOptions)))
        }}
        )
        """
    )
    return res


def js_parse_identifier(id: str) -> CardstackIdentifier:
    res = run(
        f"""
        console.log(JSON.stringify(o.parseIdentifier("{id}")))
        """
    )
    return CardstackIdentifier(res["version"], res["type"], res["uniqueId"])
