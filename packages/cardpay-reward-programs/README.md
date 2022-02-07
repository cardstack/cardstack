# Cardpay reward program 

## Setup 


    conda create --name cardpay-reward-programs python=3.9
    conda activate cardpay-reward-programs
    pip install .
    pip install ".[explore]"
    python -m cardpay_reward_programs.main
    

## Build and Packaging 

    pip install --upgrade build
    python -m build

## Explore

    streamlit run cardpay_reward_programs/explore.py

## Docker

    docker build -t reward_programs . 
