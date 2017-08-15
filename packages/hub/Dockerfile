FROM node:8.1.2-alpine AS builder
RUN apk add build-base git openssl-dev python curl-dev --update-cache
RUN npm install -g -s --no-progress yarn
RUN mkdir /app /hub
EXPOSE 3000
COPY ./package.json /hub/package.json
WORKDIR /hub
RUN yarn install --production
COPY . /hub
WORKDIR /app
CMD node /hub/v2-containers/server.js
