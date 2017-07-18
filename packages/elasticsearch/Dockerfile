FROM docker.elastic.co/elasticsearch/elasticsearch:5.4.3
ADD elasticsearch.yml /usr/share/elasticsearch/config/
USER root
RUN chown elasticsearch:elasticsearch config/elasticsearch.yml
USER elasticsearch
