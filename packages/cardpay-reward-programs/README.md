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

rule.run(1,3) #checking "which merchant receives > 100 spend" for 1< block <=3
rule.run(3,5)
rule.run(5,7)
rule.run(7,9)
rule.run(9,10)
```

## Setup

Install PDM, then install with all dependencies

    pdm install -dG explore

If you want to build as it would be used in production, you can install without optional dependencies:

    pdm install

## Run and Test

    python -m cardpay_reward_programs.main
    pdm run pytest tests

## Explore

Launch the exploratory streamlit based interface:

    pdm run explore_rules

## Docker

Each individual program can be built

    docker build -t reward_rules --no-cache .
