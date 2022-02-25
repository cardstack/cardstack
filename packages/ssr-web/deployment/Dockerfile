FROM node:14-alpine

RUN mkdir /app
WORKDIR /app
COPY . .

RUN yarn install && yarn cache clean
EXPOSE 4000
CMD node fastboot-server.js
