FROM alpine:3.8

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    python \
    py-pip \
    py-setuptools \
    rsync \
    openssh \
    git \
    nginx \
    spawn-fcgi \
    fcgiwrap \
    git-daemon

RUN mkdir /root/data-test && \
  mkdir /run/nginx/

COPY nginx.conf /etc/nginx/nginx.conf
COPY git-auth /etc/nginx/auth/git

RUN git init --bare /root/data-test/repo.git
RUN chown root:root -R /root/data-test

EXPOSE 443
EXPOSE 80
CMD spawn-fcgi -s /var/run/fcgiwrap.sock /usr/bin/fcgiwrap && nginx
