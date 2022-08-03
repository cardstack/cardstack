# Reward Root Submission

This project is for taking calculated merkle roots for reward payments and submitting them on-chain.

Results from the reward calculations are taken from the S3 bucket for that environment and submitted on chain. This is triggered from an S3 event ("s3:ObjectCreated:*") for all files that have a suffix "results.parquet". The code here will then do safety checks to make sure the file contents match the location (rewardProgramID and paymentCycle match).

## Installation

We use PDM for package management and installation - this eliminates the need for virtualenvs and improves dependency resolution.

Installation instructions are here: https://pdm.fming.dev/

Once installed, it is strongly recommended to setup the pythonpath globally.

Instructions for different shells are on the PDM website but for bash, it is:

    pdm --pep582 >> ~/.bash_profile

Restart your shell after this.

To install the dependencies, run

    pdm install -d
    
To run test, run 

    pdm run pytest tests 

## Running locally

If you install ganache, you can create a fork of sokol or gnosis with

    pdm run fork_sokol

And

    pdm run fork_gnosis

A submission can be triggered by pointing to a file either local or on S3

    ENVIRONMENT=staging EVM_FULL_NODE_URL=http://127.0.0.1:8545 python -m reward_root_submitter.manual file_path_goes_here

All required config can be overridden by setting an environment variable, otherwise they will be taken from the secrets manager

## Development

You can run black to format the code with

    pdm run black .

## Manually executing

The lambda can be triggered manually in the AWS UI, and the code can be run from your local machine.

Make sure you are in the correct AWS profile for the required environment and run the manual submitter endpoint with a file on S3.

For example

    ENVIRONMENT=staging python -m reward_root_submitter.manual  s3://cardpay-staging-reward-programs/rewardProgramID=0x5E4E148baae93424B969a0Ea67FF54c315248BbA/paymentCycle=27071744/results.parquet


## Updating ABIs

To update the ABIs used, run the helper script `update_abis.sh` with the location of the locally checked out contracts repository.

    bash update_abis.sh ~/projects/card-pay-protocol

This will switch to that repository, checkout the main branch and update, build the 

If these steps do not work, each stage can be run manually to get the ABIs.
You need to build and then copy from the subdirectory `artifacts` all of the non-debug jsons for the required contracts. 

## Releasing

You can release a new version on staging by building the image from the base of the monorepo:

     waypoint build -app=reward-submit-lambda

Then updating the function in lambda (this also waits for the new one to be live)

     aws lambda update-function-code --function-name reward_root_submitter --image-uri $(aws lambda get-function --function-name reward_root_submitter | jq -r '.Code.ImageUri') && time aws lambda wait function-updated --function-name reward_root_submitter

These steps are combined in the github action

## Issues running on M1

If you use an m1 (arm64 architecture) you may encounter errors when sub-dependencies do not have arm64 distribution.

One way to resolve this is to follow [here](https://towardsdatascience.com/how-to-use-manage-multiple-python-versions-on-an-apple-silicon-m1-mac-d69ee6ed0250). The solution is to use Rosetta for `x86` terminal emulation. After doing so, you will have a separate pdm installation in `/usr/local/bin` 




