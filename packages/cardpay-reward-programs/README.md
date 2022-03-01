# Cardpay reward program 

## Setup 

    conda create --name cardpay-reward-programs python=3.9
    conda activate cardpay-reward-programs
    pip install .
    pip install ".[explore]"
    pip install ".[dev]"
    

## Run and Test

    python -m cardpay_reward_programs.main
    pytest
    

## Build and Packaging 

    pip install --upgrade build
    python -m build

## Explore

    streamlit run streamlit/explore.py

## Docker

    docker build -t reward_programs --no-cache . 

