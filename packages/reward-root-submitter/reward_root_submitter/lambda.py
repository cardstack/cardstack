import urllib
from main import process_file, setup_logging, setup_sentry
from cloudpathlib import AnyPath
from .config import Config
import os


def handler(event, _context):
    config = Config()
    setup_logging(config)
    setup_sentry(config)
    bucket = event["Records"][0]["s3"]["bucket"]["name"]
    key = urllib.parse.unquote_plus(
        event["Records"][0]["s3"]["object"]["key"], encoding="utf-8"
    )
    process_file(AnyPath(f"s3://{bucket}/{key}"), Config())
