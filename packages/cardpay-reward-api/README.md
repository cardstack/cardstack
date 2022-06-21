# Cardpay reward api

The cardpay reward api performs:
- exposes an api to access proofs for rewardees (people who get rewards). The rewardees use these proofs to claim their reward.

## Setup

    pdm install

## Test

    pdm run pytest tests

## Env 

Export these into your local environment. We don't use .env files 

    SUBGRAPH_URL=https://graph-staging.stack.cards.com/subgraphs/name/habdelra/cardpay-sokol
    REWARDS_BUCKET=s3://tally-staging-reward-programs
    DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgres


## Run

    # start postgres 
    brew start postgresql
    
    or 
    
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
    
    
    # run 
    env DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgrespdm run main 
    
    # look at db
    psql postgresql://postgres:mysecretpassword@localhost:5432/postgres
    
Visit `localhost:8000/docs`. You can trigger the api calls from there. 

Note: it is important to prefix DB_STRING with `postgresql`
    
## Deploy 

This application is deployed via a manual dispatch of a github action 
