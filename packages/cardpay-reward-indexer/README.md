# Cardpay reward indexer

The cardpay reward indexer performs:
- indexing of proofs (runs every 5s) into an rds db. The indexer is meant to be stateless; blowing away the tables in the db will recover all necessary state for the proofs. 

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
    env DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgres pdm run main 
    
    # look at db
    psql postgresql://postgres:mysecretpassword@localhost:5432/postgres

Note: it is important to prefix DB_STRING with `postgresql`

## Scripts 

You can check if the dbs are synced with s3 by

        DB_STRING="<tunnel db string>" ENVIRONMENT="staging" AWS_PROFILE="<staging profile>" pdm run check_sync

## Deploy 

This application is deployed via a manual dispatch of a github action 
