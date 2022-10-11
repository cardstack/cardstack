import hashlib
from typing import Optional

from fastapi_cache import FastAPICache
from starlette.requests import Request
from starlette.responses import Response


def my_key_builder(
    func,
    namespace: Optional[str] = "",
    request: Request = None,
    response: Response = None,
    *args,
    **kwargs,
):

    prefix = f"{FastAPICache.get_prefix()}:{namespace}:"
    if kwargs.get("kwargs"):
        kwargs["kwargs"].pop(
            "reward_manager", None
        )  # web3 instance changes the hash. we need to pop it
    cache_key = (
        prefix
        + hashlib.md5(  # nosec:B303
            f"{func.__module__}:{func.__name__}:{args}:{kwargs}".encode()
        ).hexdigest()
    )
    return cache_key
