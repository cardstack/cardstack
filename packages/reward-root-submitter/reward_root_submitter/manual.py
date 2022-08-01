import urllib
from .main import process_file, setup_logging
from cloudpathlib import AnyPath
from .config import Config
import sys


config = Config()
setup_logging(config)

if __name__ == "__main__":
    file_path = sys.argv[1]
    print(file_path)
    process_file(AnyPath(file_path), Config())
