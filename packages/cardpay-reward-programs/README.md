# Cardpay reward program

This repository is the code for reward rules. A reward rule is a piece of code that a reward program uses to issue different types of rewards to it's rewardees, e.g. cashback, airdrops. The rules defined are shared across reward programs.

## Setup

Install PDM, then install with all dependencies

    pdm install -dG explore

If you want to build as it would be used in production, you can install without optional dependencies:

    pdm install

## Run and Test

    RULE=<Rule Name> pdm run python -m cardpay_reward_programs.main
    RULE=WeightedUsage pdm run python -m cardpay_reward_programs.main
    pdm run pytest tests

## Explore

Launch the exploratory streamlit based interface:

    pdm run explore_rules

Decode and inspect payment list 

    pdm run inpect_results 

## Docker

Each individual program can be built by specifying the rule class name as a build argument, for example:

    docker build --build-arg rule=FlatPayment -t flat_payment .

    docker run -v ~/.aws:/root/.aws  -v `pwd`/input:/host -v `pwd`/.cache:/app/.cache --env AWS_PROFILE=cardstack --rm -it flat_payment:latest /host/parameters.json /host/
    
If you are using an m1 laptop, you should add `--platform=linux/amd64` flag.

## Perform Flat Drop

``` sh
pdm run flat_drop --env staging
```


