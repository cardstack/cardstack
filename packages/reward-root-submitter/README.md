# Reward Root Submission

This project is for taking calculated merkle roots for reward payments and submitting them on-chain.

Results from the reward calculations are taken from the S3 bucket specified

## Installation

We use PDM for package management and installation - this eliminates the need for virtualenvs and improves dependency resolution.

Installation instructions are here: https://pdm.fming.dev/

Once installed, it is strongly recommended to setup the pythonpath globally.

Instructions for different shells are on the PDM website but for bash, it is:

    pdm --pep582 >> ~/.bash_profile

Restart your shell after this.

To install the dependencies, run

    pdm install -d

## Running locally

If you install ganache, you can create a fork of sokol or gnosis chain with

    pdm run fork_sokol

And

    pdm run fork_gnosis

Create a .env file with the following contents, adding in the private key and the S3 bucket name.

    ETHEREUM_NODE_URL=http://127.0.0.1:8545
    REWARD_POOL_ADDRESS=0xc9A238Ee71A65554984234DF9721dbdA873F84FA
    OWNER=0x159ADe032073d930E85f95AbBAB9995110c43C71
    OWNER_PRIVATE_KEY=
    REWARD_PROGRAM_OUTPUT=
    LOGLEVEL=INFO

Now running

    python -m reward_root_submission.main

will enter a 60 second loop that will submit the merkle root for all rewards that have been calculated.

## Development

You can run black to format the code with

    pdm run black .

You can build the docker image locally with

    docker build -t reward_root_submission .

And run the image with

    docker run --network host -v $HOME/.aws/:/root/.aws -v `pwd`/.env:/project/.env --rm -it reward_root_submission

### Releasing

You can release a new version on staging by running the following command in the root of the monorepo:

     waypoint up -app=reward-submit -prune-retain=0

This will remove the previous deployment, build the docker image and deploy a new service.
