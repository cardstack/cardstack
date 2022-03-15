import pytest
from cloudpathlib import AnyPath, implementation_registry
from cloudpathlib.local import LocalS3Client, LocalS3Path, local_s3_implementation
from cloudpathlib.local.implementations.s3 import LocalS3Client


@pytest.fixture
def indexed_data(monkeypatch):
    """Fixture that patches CloudPath dispatch and also sets up test assets in LocalS3Client's
    local storage directory."""
    common_path = "cardpay-staging-partitioned-graph-data/data/staging_rewards/0.0.1"
    test_config_location = "tests/" + common_path

    monkeypatch.setitem(implementation_registry, "s3", local_s3_implementation)
    test_data_path = AnyPath(test_config_location)
    if not test_data_path.exists():
        raise Exception("Oops. Ensure test data directory exists")

    local_cloud_path = LocalS3Path("s3://" + common_path)
    local_cloud_path.upload_from(test_data_path, force_overwrite_to_cloud=True)
    yield

    LocalS3Client.reset_default_storage_dir()
