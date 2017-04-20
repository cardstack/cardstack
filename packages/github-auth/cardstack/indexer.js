const request = require('./lib/request');

module.exports = class GitHubIndexer {
  /*
     TODO: configuration UI for
     - authorizing with scope read:org to get ownToken
     - navigating through https://api.github.com/user/orgs and
       /orgs/:org/teams to let the user pick teamIds
  */
  constructor({ ownToken, teamIds }, dataSourceId) {
    this.ownToken = ownToken;
    this.teamIds = teamIds;
    this.dataSourceId = dataSourceId;
  }

  async branches() {
    // this data source is not multi-branched (authorization data is
    // always on the controlling branch anyway)
    return ['master'];
  }

  async beginUpdate(/* branch */) {
    return new GitHubUpdater(this.ownToken, this.teamIds, this.dataSourceId);
  }


};

class GitHubUpdater {
  constructor(ownToken, teamIds, dataSourceId) {
    this.ownToken = ownToken;
    this.teamIds = teamIds;
    this.dataSourceId = dataSourceId;
  }

  async schema() {
    return [
      {
        type: "fields",
        id: "full-name",
        attributes: {
          "field-type": "@cardstack/core-types::string"
        }
      },
      {
        type: "fields",
        id: "email",
        attributes: {
          "field-type": "@cardstack/core-types::string"
        }
      },
      {
        type: "fields",
        id: "avatar",
        attributes: {
          "field-type": "@cardstack/core-types::string"
        }
      },
      {
        type: "content-types",
        id: "users",
        "relationships": {
          "data-source": this.dataSourceId,
          "fields": {
            "data": [
              {
                "type": "fields",
                "id": "full-name"
              },
              {
                "type": "fields",
                "id": "email"
              },
              {
                "type": "fields",
                "id": "avatar"
              }
            ]
          }
        }
      }
    ];
  }

  async updateContent(meta, hints, ops) {
    let options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/user',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '@cardstack/github-auth',
        Authorization: `token ${this.ownToken}`
      }
    };

    let response = await request(options);

  }

}
