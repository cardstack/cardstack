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
    git

RUN ssh-keygen -A

COPY cardstack-test-key.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys && chown root:root /root/.ssh/authorized_keys
RUN mkdir /root/data-test
RUN git init --bare /root/data-test
RUN chown root:root -R /root/data-test

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D", "-f", "/etc/ssh/sshd_config"]
