# Cardpay reward indexer

The cardpay reward indexer perform indexing of proofs into an rds db. 

**Every 5s**, for each reward program it indexes 
    - new roots (starting from last indexed block)
    - new proofs corresponding to that root

The indexer is meant to be stateless; blowing away the tables in the db and restarting the process  will recover all necessary state for the proofs. 

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

    env DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgres pdm run main 

Note: it is important to prefix DB_STRING with `postgresql`

## Scripts 

You can check if the dbs are synced with s3 by

        env DB_STRING="<tunnel db string>" ENVIRONMENT="<staging or production" AWS_PROFILE="<aws profile>" pdm run check_sync

## Deploy 

This application is deployed via a manual dispatch of a github action 
