# Cardpay Reward Scheduler

This project launches jobs in AWS batch to calculate the rewards for the reward programs. It does not submit the result on-chain, but is responsible for orchestrating the calculation of the results.

The calculations happen in docker containers, the cardstack containers are defined in the package `cardpay-reward-programs`

The results are written on chain by the package `reward-root-submitter`.

The SDK/end users get their proofs via the `cardpay-reward-api` package.

## Process

1. Iterate over all allowed reward programs on chain which are not 'locked' (the locked flag on chain means that no rewards should be computed right now)
2. For each, get the "rules" which define what should be calculated
    * The rules are in a json blob stored on chain
    * Each rule defines the docker image to run & the parameters (start & end range, data dependencies, etc)
3. For each rule in each reward program, find all payment cycles which:
    1. Have not yet been processed
    2. Are in the range start_block <= payment_cycle < end_block
    3. Have enough data to calculate (last block in data <= payment_cycle) 
4. Launch jobs on AWS batch to calculate the results
5. Loop around to 1 waiting for new payment cycles to become valid targets for computation

# Installing

We use PDM for the package management: https://pdm.fming.dev/

Once this is installed you can install the required packages with

    pdm install

# Developing

If you are manually testing the scheduler locally, set an environment variable DRY_RUN=TRUE to prevent the scheduler from submitting jobs to AWS batch.

    DRY_RUN=TRUE python -m reward_scheduler.main

# Deploying

This project is deployed using waypoint:

    waypoint up --app=reward-scheduler --prune-retain=0