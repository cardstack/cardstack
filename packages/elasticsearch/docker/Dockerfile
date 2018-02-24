FROM docker.elastic.co/elasticsearch/elasticsearch:5.6.8
COPY --chown=elasticsearch:elasticsearch elasticsearch.yml /usr/share/elasticsearch/config/
COPY --chown=elasticsearch:elasticsearch jvm.options /usr/share/elasticsearch/config/
HEALTHCHECK --interval=30s --timeout=3s --start-period=100ms --retries=3 CMD curl -f http://localhost:9200/ || exit 1
