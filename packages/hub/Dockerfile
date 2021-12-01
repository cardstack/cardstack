FROM node:14-alpine
WORKDIR /workspace
COPY dist packages/hub/dist
COPY config packages/hub/config
COPY dist/sql node_modules/graphile-worker/sql
RUN mkdir node_modules/graphile-worker/dist
WORKDIR /workspace/packages/hub
CMD node ./dist/hub.js serve
