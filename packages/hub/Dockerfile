FROM node:8.1.2-alpine AS builder
RUN apk add build-base git openssl-dev python curl-dev curl --update-cache
RUN npm install -g -s --no-progress yarn
# Install the docker client only
RUN curl "https://download.docker.com/linux/static/stable/x86_64/docker-17.06.0-ce.tgz" > docker-17.06-ce.tgz &&\
    tar -xzf docker-17.06-ce.tgz &&\
    cp docker/docker /usr/local/bin &&\
    rm -rf docker-17.06-ce.tgz docker
EXPOSE 3000
COPY package.json yarn.lock /hub/src/
WORKDIR /hub/src/
RUN yarn install --production
COPY . /hub/src
WORKDIR /app
CMD node /hub/v2-containers/server.js
