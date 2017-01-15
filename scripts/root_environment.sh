#!/bin/bash

private_ip=$1

set -e

add_node_repo() {
    wget -qO- https://deb.nodesource.com/setup_7.x | bash -
}

add_yarn_repo() {
    wget -qO- https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
}

add_elasticsearch_repo() {
    wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
    echo "deb https://artifacts.elastic.co/packages/5.x/apt stable main" | sudo tee -a /etc/apt/sources.list.d/elastic-5.x.list
}

add_elasticsearch_repo
add_yarn_repo
add_node_repo
apt-get install -y nodejs yarn default-jre-headless elasticsearch build-essential
echo "network.host: [$private_ip, _local_]" >> /etc/elasticsearch/elasticsearch.yml

/bin/systemctl daemon-reload
/bin/systemctl enable elasticsearch.service



