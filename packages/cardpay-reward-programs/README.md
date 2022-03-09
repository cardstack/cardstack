# Cardpay reward program 

This repository is the code for reward rules. A reward rule is a piece of code that a reward program uses to issue different types of rewards to it's rewardees, e.g. cashback, airdrops. A single reward program can have multiple reward rules. The rules defined are shared across reward programs.

Reward rule defines:
- the business logic of the reward, e.g. each merchant that receives minimum 100 spend will receive 10 card tokens. This business logic will run as a job from `some_block < x <= some_block + payment_cycle_length`.
- the frequency the rule is computed, e.g. every month. Each rule run will recur over several jobs over `start_block < x <= end_block` -- a moving window. 

For example, 

```
start_block=1 
end_block=10
payment_cycle_length=2

rule.run(1,3) #checking how "which merchant receives > 100 spend" 1< block <=3 
rule.run(3,5) 
rule.run(5,7)
rule.run(7,9)
rule.run(9,10) 
```

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
    

## Docker

    docker build -t reward_rules --no-cache . 
    








