FROM node:12
WORKDIR /srv/hub

COPY dep-layer/ ./

# install and configure logrotate to manage
# our node log files
RUN apt-get update \
  && apt-get -y install logrotate \
  && echo '\
/srv/hub/logs/node.log {\n\
  daily\n\
  missingok\n\
  create 0660 root root\n\
  rotate 30\n\
}'\
>> /etc/logrotate.conf

RUN BUILD_ONLY=true yarn install && yarn cache clean

COPY code-layer/ ./
RUN ./node_modules/.bin/tsc
RUN chmod +x ./packages/hub/bin/cardstack-hub.js

# This service helps you easily access Docker container logs.
# Log file emitters can be managed in PaperTrail's dashboard.
RUN curl -L https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote-syslog2_0.20_amd64.deb -o remote-syslog2.deb \
  && dpkg -i ./remote-syslog2.deb \
  && apt-get install -f \
  && rm ./remote-syslog2.deb
RUN mkdir -p /srv/hub/logs \
  && echo '\
files: \n\
 - /srv/hub/logs/node.log\n\
destination:\n\
 host: logs3.papertrailapp.com\n\
 port: 41828\n\
 protocol: tls\n\
pid_file: /var/run/remote_syslog.pid'\
> /etc/log_files.yml

CMD remote_syslog --hostname "${TARGET_ENV:-unknown_env}_$(hostname)" && ./packages/hub/bin/cardstack-hub.js 2>&1 | tee -a /srv/hub/logs/node.log

# This configuration will cause the container to restart after
# 30 seconds without a successful response.
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 CMD curl -f -H "Accept:application/vnd.api+json" \
  "http://localhost:3000/api/cards?page%5Bsize%5D=1" || exit 1