FROM node:14-alpine
ARG hub_command
ENV stored_hub_command=$hub_command
WORKDIR /workspace
COPY dist packages/hub/dist
COPY config packages/hub/config
COPY dist/sql node_modules/graphile-worker/sql
RUN mkdir node_modules/graphile-worker/dist
WORKDIR /workspace/packages/hub
CMD node ./dist/hub.js $stored_hub_command
