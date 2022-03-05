# Cardpay reward program 

This repository is the code for reward rules. A reward rule is a piece of code that a reward program uses to issue different types of rewards to it's rewardees. A single reward program can have multiple reward rules. The rules defined here may be shared across reward programs. 

Reward rule defines:
- the business logic of the reward, e.g. each merchant that receives minimum 100 spend will receive 10 card tokens 
- the frequency the rule is computed, e.g. every month 

## Setup 

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
    
You can optionally build streamlit in a docker container
 
    docker-compose up 

## Docker

    docker build -t reward_rules --no-cache . 
    








