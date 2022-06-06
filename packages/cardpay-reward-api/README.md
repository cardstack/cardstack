# Cardpay reward api

The cardpay reward api performs:
- indexing of proofs (runs every 5s) into an rds db. The indexer is meant to be stateless; blowing away the tables in the db will recover all necessary state for the proofs. 
- exposes an api to access proofs.

## Setup


    pdm install

## Test

    pdm run pytest tests

## Run

    # start postgres 
    brew start postgresql
    
    or 
    
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
    
    
    # run 
    pdm run main 
    
    # look at db
    psql postgresql://postgres:mysecretpassword@localhost:5432/postgres

Visit `localhost:8000/docs`. You can trigger the api calls from there. 
    
## Env 

Set these values as the .env file at the root of the subpackage
    
    SUBGRAPH_URL=https://graph-staging.stack.cards.com/subgraphs/name/habdelra/cardpay-sokol
    REWARDS_BUCKET=s3://tally-staging-reward-programs
    DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgres


## Docker

    DOCKER_BUILDKIT=0 docker build  -t reward-api .
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword --net <some created network> --net-alias postgres -p 5432:5432 -d postgres
    docker run -v ~/.aws:/root/.aws --env AWS_PROFILE=cardstack-prod --net <some created network> -p 8000:8000 reward-api:latest

## Deploy 

This application is deployed via a manual dispatch of a github action 
