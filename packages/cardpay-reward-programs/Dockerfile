FROM --platform=linux/amd64 python:3.9-slim 
RUN apt-get update \
    && apt-get install gcc -y \
    && apt-get clean
RUN apt-get update && apt-get install -y git
RUN mkdir /app
WORKDIR /app
ADD . .
RUN pip install -e .
