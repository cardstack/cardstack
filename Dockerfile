FROM node:14
WORKDIR /workspace
COPY . .
RUN yarn install --frozen-lockfile; yarn cache clean