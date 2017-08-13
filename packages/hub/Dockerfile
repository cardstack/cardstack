FROM node:8.1.2-alpine AS builder
RUN apk add build-base git openssl-dev python curl-dev --update-cache
RUN npm install -g -s --no-progress yarn
RUN mkdir /app /hub
EXPOSE 3000
COPY . /hub
WORKDIR /hub
RUN yarn install --production
WORKDIR /app
