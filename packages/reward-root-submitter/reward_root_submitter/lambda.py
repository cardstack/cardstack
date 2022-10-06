import logging
import urllib

import sentry_sdk
from cloudpathlib import AnyPath
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

from .config import Config
from .main import get_all_unsubmitted_roots, process_file, setup_logging

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
    if event.get("source") == "aws.events":
        logging.info("Cron event triggered")
        unsubmitted_roots = get_all_unsubmitted_roots(config)
        for index, row in unsubmitted_roots.iterrows():
            process_file(row["file"], config)
    elif event["Records"][0]["eventSource"] == "aws:s3":
        bucket = event["Records"][0]["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(
            event["Records"][0]["s3"]["object"]["key"], encoding="utf-8"
        )
        process_file(AnyPath(f"s3://{bucket}/{key}"), Config())
