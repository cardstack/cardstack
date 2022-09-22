import logging
import urllib

import sentry_sdk
from cloudpathlib import AnyPath
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

from .config import Config
from .main import process_file, setup_logging

config = Config()
setup_logging(config)

sentry_sdk.init(
    dsn=config.reward_root_submitter_sentry_dsn,
    integrations=[
        AwsLambdaIntegration(),
    ],
    environment=config.environment,
    traces_sample_rate=1.0,
)


def handler(event, _context):
    if event["source"] == "aws.events":
        logging.info("event triggered")
        # TODO: get_all_unsubmitted_roots & write to blockchain
    elif event["Records"]["eventSource"] == "aws.s3":
        bucket = event["Records"][0]["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(
            event["Records"][0]["s3"]["object"]["key"], encoding="utf-8"
        )
        process_file(AnyPath(f"s3://{bucket}/{key}"), Config())
