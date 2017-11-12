FROM node:8
ADD stage1.tar /cardstack
WORKDIR /cardstack
RUN yarn install
RUN node ./node_modules/.bin/lerna bootstrap
ADD stage2.tar /cardstack

# install chrome
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qqy \
  && apt-get -qqy install \
       gnupg wget ca-certificates apt-transport-https \
       ttf-wqy-zenhei \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update -qqy \
  && apt-get -qqy install google-chrome-unstable \
  && rm /etc/apt/sources.list.d/google-chrome.list \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# chrome gets angry about running as root
RUN useradd cardstack --shell /bin/bash --create-home
RUN chown -R cardstack /cardstack
USER cardstack

CMD yarn test
