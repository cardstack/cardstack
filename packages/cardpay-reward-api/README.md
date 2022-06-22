# Cardpay reward api

The cardpay reward api exposes an api to access proofs for rewardees (people who get rewards). The rewardees use these proofs to claim their reward.

This reward api works together with the [reward indexer](../cardpay-reward-indexer/README.md); you should set that up as a pre-requisite. 

You can visit the live api on [production](https://reward-api.cardstack.com/docs) and on [staging](https://reward-api-staging.stack.cards).

## Setup

Install dependencies

    pdm install
    
Setup your local instance of postgres
    
    brew start postgresql

    # or 

    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
        
    psql postgresql://postgres:mysecretpassword@localhost:5432/postgres

## Test

    pdm run pytest tests

## Env 

By default, the envronment is setup to run with staging variables; there is no need to setup .env file except for your local postgres setup.

You can easily overwrite env variables by either exporting them into your environment or prefixing them when running the main command(as below).

## Run

    env DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgrespdm run main 
    
    
Visit `localhost:8000/docs`. You can trigger the api calls from there. 

Note: it is important to prefix DB_STRING with `postgresql`
    
## Deploy 

This application is deployed via a manual dispatch of a github action 
