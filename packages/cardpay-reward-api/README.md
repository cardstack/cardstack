# Cardpay reward api

## Setup

    pdm install

## Run

    pdm run main
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
    or 
    brew services list
    
    and
    pdm run test
    
    
Visit `localhost:8000/docs`

## Docker

    DOCKER_BUILDKIT=0 docker build  -t reward-api .
    docker run --name some-postgres --rm -it -e POSTGRES_PASSWORD=mysecretpassword --net justin --net-alias postgres -p 5432:5432 -d postgres 
    docker run -v ~/.aws:/root/.aws --env AWS_PROFILE=cardstack-prod --net justin -p 8000:8000 reward-api:latest


## Insepcting db

    psql postgresql://postgres:mysecretpassword@localhost:5432/postgres
