from setuptools import find_packages, setup

setup(
    name="cardpay_reward_programs",
    version="0.0.1",
    description="Pull data from graph-node databases into parquet files",
    url="http://github.com/cardstack/cardstack",
    author="Ian Calvert",
    author_email="ian.calvert@cardstack.com",
    license="MIT",
    install_requires=[
        "pyyaml",
        "fastparquet",
        "typer",
        "duckdb",
        "pandas",
        "cloudpathlib[s3]",
        "boto3",
        "eth_utils",
        "eth_abi",
        "eth_typing",
        "merklelib @ git+https://git@github.com/cardstack/merklelib@master#egg=merklelib",
        "pysha3",
        "pyarrow",
    ],
    extras_require={
        "explore": ["streamlit", "altair", "parquet-tools"],
        "dev": ["black", "isort", "pytest"],
    },
    entry_points={
        "console_scripts": ["run_reward_program=cardpay_reward_programs.main:cli"],
    },
    packages=find_packages(),
    zip_safe=False,
)
