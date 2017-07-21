FROM node:8.1.2-alpine AS builder
RUN apk add build-base git openssl-dev python curl-dev --update-cache
RUN npm install -g -s --no-progress yarn
RUN mkdir - /app
WORKDIR /app
EXPOSE 3000
