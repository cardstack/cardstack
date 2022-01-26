FROM node:14-alpine
ARG hub_command
ENV stored_hub_command=$hub_command
WORKDIR /workspace
COPY dist packages/hub/dist
COPY config packages/hub/config
COPY dist/sql node_modules/graphile-worker/sql
# This includes the discord bot image assets that are hosted by the hub
COPY dist/services packages/hub/services

# Replicate enough of the node_modules structure to support node-pg-migrate
COPY dist/node-pg-migrate node_modules/node-pg-migrate
COPY dist/pg node_modules/pg
COPY dist/pg-connection-string node_modules/pg-connection-string
COPY dist/pg-format node_modules/pg-format
COPY dist/pg-int8 node_modules/pg-int8
COPY dist/pg-pool node_modules/pg-pool
COPY dist/pg-protocol node_modules/pg-protocol
COPY dist/pg-types node_modules/pg-types
COPY dist/pgpass node_modules/pgpass
COPY dist/postgres-array node_modules/postgres-array
COPY dist/postgres-bytea node_modules/postgres-bytea
COPY dist/postgres-date node_modules/postgres-date
COPY dist/postgres-interval node_modules/postgres-interval
COPY dist/buffer-writer node_modules/buffer-writer
COPY dist/packet-reader node_modules/packet-reader
COPY dist/xtend node_modules/xtend
COPY dist/split2 node_modules/split2
COPY dist/readable-stream node_modules/readable-stream
COPY dist/inherits node_modules/inherits
COPY dist/string_decoder node_modules/string_decoder
COPY dist/util-deprecate node_modules/util-deprecate
COPY dist/lodash node_modules/lodash
COPY dist/fs-extra node_modules/fs-extra
COPY dist/graceful-fs node_modules/graceful-fs
COPY dist/jsonfile node_modules/jsonfile
COPY dist/universalify node_modules/universalify

RUN mkdir node_modules/graphile-worker/dist
WORKDIR /workspace/packages/hub
CMD node --no-deprecation ./dist/hub.js db migrate up --no-check-order && node --no-deprecation ./dist/hub.js $stored_hub_command
