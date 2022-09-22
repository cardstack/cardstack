import sys

from cloudpathlib import AnyPath

from .config import Config
from .main import get_all_unsubmitted_roots, process_file, setup_logging

config = Config()
setup_logging(config)

if __name__ == "__main__":
    get_all_unsubmitted_roots(config)
