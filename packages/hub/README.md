# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md).

## Architecture

The Hub consists of API endpoints and a postgres database.

## Running locally
After configuration and database setup as described below, start this by running `yarn start`. 

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `SERVER_SECRET` (required) - to generate one for your machine, run `node --eval="console.log(crypto.randomBytes(32).toString('base64'))"`
- `DATABASE_URL` - defaults in development to postgres://postgres:postgres@localhost:5432/hub_development
- `LOG_LEVELS` - defaults to `*=info`

Search the mono-repo for `process.env` and check the config directory to see these variables referenced.

## Setting up a local database for the first time

The following command will create a hub_development database on your locally running postgres server, run migrations, and load seed data. It will then create a hub_test database, and clone the structure of the development database to it.

`yarn db:setup:local`

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.


## Running database migrations

`yarn db:migrate up`

To reverse the last migration:

`yarn db:migrate down`

To redo the last migration (i.e. down + up):

`yarn db:migrate redo`

## Loading database seed data

`yarn db:seed`



## Deploying to staging

Green builds of the main branch deploy hub to staging if the commit contains changes to the hub package or its dependencies. The deploy uses waypoint.

## Connecting to the database

### Setup AWS Session Manager ssh config

Add the following to your `~/.ssh/config` file:

```
# SSH over Session Manager
host i-* mi-*
    ProxyCommand sh -c "aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters 'portNumber=%p'"
```

Lookup the tunneling command and database password:

```
cd [PROJECTS]/cardstack/infra/configs/hub/[staging|production]
AWS_PROFILE=cardstack terraform output | grep tunnel_to_database
AWS_PROFILE=cardstack terraform output | grep postgres_password
```

Run the command, open a postgres client, and connect to localhost, port 55432 with username cardstack, password as looked up in previous step.



## Provided APIs
APIs conform to the [JSON API specification](https://jsonapi.org/).

### GET /api/prepaid-card-patterns
Fetches images available to use as background patterns for customized prepaid cards.

#### Response structure
```
{
  data: PatternCustomizationResponseObject[]
}

interface PatternCustomizationResponseObject {
  attributes: {
    'pattern-url': string;
    description: string;
  };
  id: string; // This id will be used when saving a customization
}
```

| Attribute   | What it means                         |
|-------------|---------------------------------------|
| pattern-url | Url to the image                      |
| description | Human-readable name for the pattern   |

#### Example

```javascript
// Request
fetch(`http://localhost:3000/api/prepaid-card-patterns`, {
  method: 'GET',
  headers: {
    Accept: 'application/vnd.api+json',
  },
})
.then(v => v.json())
.then((v) => {
  console.log(v);
})

// Response
{
  data: [
    {
      type: 'prepaid-card-patterns',
      id: '543423cb-de7e-44c2-a9e1-902b4648b8fb',
      attributes: {
        'pattern-url': 'https://example.com/a.svg',
        description: 'Pattern A',
      },
    },
  ]
}
```

### GET /api/prepaid-card-color-schemes
Fetches color schemes available to customize prepaid cards. 

#### Response structure
```
{
  data: ColorCustomizationResponseObject[]
}

interface ColorCustomizationResponseObject {
  attributes: {
    background: string;
    'pattern-color': string;
    'text-color': string;
    description: string;
  };
  id: string; // This id will be used when saving a customization
}
```

| Attribute     | What it means                                                     |
|---------------|-------------------------------------------------------------------|
| background    | Background color of the card header                               |
| pattern-color | Color of the image (see pattern-url) overlaid on the background   |
| text-color    | Color of text on the header                                       |
| description   | A human readable name for the pattern                             |

#### Example

```javascript
// Request
fetch(`http://localhost:3000/api/prepaid-card-color-schemes`, {
  method: 'GET',
  headers: {
    Accept: 'application/vnd.api+json',
  },
})
.then(v => v.json())
.then((v) => {
  console.log(v);
})

// Response
{
  data: [
    {
      "id": "7cee903b-e342-4bd7-a3da-eb3ab2dc078d",
      "type": "prepaid-card-color-schemes",
      "attributes": {
          "background": "#00ebe5",
          "pattern-color": "white",
          "text-color": "black",
          "description": "Solid Light Blue"
      }
    }
  ]
}
```

### POST /api/prepaid-card-customizations
Saves a prepaid card's customization options so they can be retrieved later using a DID. This requires the user to be authenticated.

#### Request structure
```
{
  data: {
    type: 'prepaid-card-customizations',
    attributes: {
      'issuer-name': string,
    },
    relationships: {
      'color-scheme': {
        data: {
          type: 'prepaid-card-color-schemes',
          id: string,
        },
      },
      pattern: {
        data: {
          type: 'prepaid-card-patterns',
          id: string,
        },
      },
    },
  },
}
```

| Parameter                          | What it means                                        |
|------------------------------------|------------------------------------------------------|
| data.attributes.issuer-name             | The displayed name of the issuer on the prepaid card |
| data.relationships.color-scheme.data.id | A valid color scheme id                              |
| data.relationships.pattern.data.id      | A valid pattern id                                   |

#### Response structure
```
{
  data: {
    type: 'prepaid-card-customizations',
    id: string, // the id of the object stored in database
    attributes: {
      did: string, // an id used to retrieve stored styles
      'issuer-name': 'Satoshi Nakamoto',
      'owner-address': stubUserAddress,
    },
    relationships: {
      pattern: {
        data: {
          type: 'prepaid-card-patterns',
          id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
        },
      },
      'color-scheme': {
        data: {
          type: 'prepaid-card-color-schemes',
          id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
        },
      },
    },
  },
}
```

| Property            | What it means                                             |
|---------------------|-----------------------------------------------------------|
| data.id             | The id of the object stored in database                   |
| data.attributes.did | The DID (see did-resolver) used to retrieve stored styles |


#### Example request
This example assumes an authenticated user.

```javascript
fetch('http://localhost:3000/api/prepaid-card-customizations', {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    Authorization: `Bearer xxx`
  },
  body: JSON.stringify({
    data: {
      type: 'prepaid-card-customizations',
      attributes: {
        'issuer-name': 'Satoshi Nakamoto',
      },
      relationships: {
        'color-scheme': {
          data: {
            type: 'prepaid-card-color-schemes',
            id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
          },
        },
        pattern: {
          data: {
            type: 'prepaid-card-patterns',
            id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
          },
        },
      },
    },
  })
}))
```
