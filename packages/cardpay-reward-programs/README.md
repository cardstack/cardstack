# Cardpay reward program

This repository is the code for reward rules. A reward rule is a piece of code that a reward program uses to issue different types of rewards to it's rewardees, e.g. cashback, airdrops. The rules defined are shared across reward programs.

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

Each individual program can be built by specifying the rule class name as a build argument, for example:

    docker build --build-arg rule=FlatPayment -t flat_payment .
