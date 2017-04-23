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
          "data-source": { data: { type: "data-sources", id: this.dataSourceId } },
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
    let users = new Map();
    for (let teamId of this.teamIds) {
      for (let member of await this._getTeamMembers(teamId)) {
        let record = users.get(member.id);
        if (!record) {
          let user = await this._getUser(member.login);
          record = {
            id: user.id,
            type: 'users',
            attributes: {
              'full-name': user.name,
              email: user.email,
              avatar: user.avatar_url
            },
            relationships: {
              groups: {
                data: []
              }
            }
          };
          users.set(record.id, record);
        }
        record.relationships.groups.data.push({ type: 'groups', id: teamId });
      }
    }
    for (let user of users.values()) {
      await ops.save('users', user.id, user);
    }
  }

  async _getTeamMembers(teamId) {
    let options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/teams/${teamId}/members`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '@cardstack/github-auth',
        Authorization: `token ${this.ownToken}`
      }
    };
    let response = await request(options);
    return response.body;
  }

  async _getUser(login) {
    let options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/users/${login}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '@cardstack/github-auth',
        Authorization: `token ${this.ownToken}`
      }
    };
    let response = await request(options);
    return response.body;
  }


}
