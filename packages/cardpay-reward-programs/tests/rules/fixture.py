import pytest
from cloudpathlib import AnyPath, implementation_registry
from cloudpathlib.local import LocalS3Client, LocalS3Path, local_s3_implementation
from cloudpathlib.local.implementations.s3 import LocalS3Client


@pytest.fixture
def indexed_data(monkeypatch):
    """Fixture that patches CloudPath dispatch and also sets up test assets in LocalS3Client's
    local storage directory."""

    client = LocalS3Client(local_storage_dir='tests/resources')

    monkeypatch.setitem(implementation_registry, "s3", local_s3_implementation)
    client.set_as_default_client()
    test_data_path = AnyPath('s3://partitioned-graph-data/data/staging_rewards/0.0.1')
    if not test_data_path.exists():
        raise Exception("Oops. Ensure test data directory exists")

    yield

    LocalS3Client.reset_default_storage_dir()
