# Cardpay reward api

## Setup

    pdm install

## Run

    # start postgres 
    brew start postgresql
    
    or 
    
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
    
    
    # run 
    pdm run main

Visit `localhost:8000/docs`
    
## Env 
    
        SUBGRAPH_URL=https://graph-staging.cardstack.com/subgraphs/name/habdelra/cardpay-sokol
    REWARDS_BUCKET=s3://tally-staging-reward-programs
    DB_STRING=postgresql://postgres:mysecretpassword@localhost:5432/postgres


## Docker


    DOCKER_BUILDKIT=0 docker build  -t reward-api .
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword --net <some created network> --net-alias postgres -p 5432:5432 -d postgres
    docker run -v ~/.aws:/root/.aws --env AWS_PROFILE=cardstack-prod --net <some created network> -p 8000:8000 reward-api:latest

