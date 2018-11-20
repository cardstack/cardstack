# Plugin API

## General Plugin Structure

A plugin is an NPM module with "cardstack-plugin" in its package.json keywords. Additionally, it must declare its API version in package.json like:

```
  "cardstack-plugin":{ "api-version": 1 }
```

At the time of writing, everything is api-version 1.

Optionally, a plugin can declare what subdirectory it's cardstack-specific modules live under, like:

```
  "cardstack-plugin":{ 
    "api-version": 1,
    "src": "cardstack"
  }
```

This is particularly useful for modules that are also ember-addon or standlalone libraries in their own right.

A plugin can provide many different kinds of cardstack features. See the `featureTypes` list in `packages/hub/plugin-loader` for the definitive list. This currently includes:

 - constraints
 - fields
 - computed-fields
 - writers
 - searchers
 - indexers
 - authenticators
 - middleware
 - messengers
 - code-generators

Features are discovered and named via conventions. This is probably best illustrated by example. Given an NPM package named "my-cardstack-plugin" (with no `src` in the `cardstack-plugin` section in its `package.json`), the following files will result in the following discovered features:

 - field.js: a field named "my-cardstack-plugin"
 - writer.js: a writer named "my-cardstack-plugin"
 - fields/color.js: a field named "my-cardstack-plugin::color"
 - fields/flavor.js: a field named "my-cardstack-plugin::flavor" 


## Authenticator

An authenticator plugin offers a new way to identify users. 

Users configure an authenticator by creating an `authentication-source` resource and setting its `authenticator-type` to the name of an authenticator plugin, like:

```
POST /authentication-sources
{
  type: 'authentication-sources',
  attributes: {
    authenticator-type: 'your-authenticator-plugin-name'
    params: {
      /* plugin specific configuration can go here */
    }
  }
}
```

An authenticator plugin implements server-side user verification by exporting an `authenticate` method:

```js
exports.authenticate = async function(payload, params, userSearcher) {
  return {
    user: { id: 1 }
  };
};
```

`payload` is the plugin-specific inputs provided by the user. For example, it could contain a username and password or an authorization token from a third-party provider.

`params` is the plugin-specific `params` that the user provided when creating the authentication-source. It's a good place to store things like the hostname of a third-party authorization server you need to speak to.

`userSearcher` is a `Searcher` that's preconfigured to the correct branch and type for searching users. Your plugin may not need to search for users, but it can if it needs to.

The return value from `authenticate` should contain one of the following properties:

`preloadedUser`: if you used `userSearcher` to load a user, and you want to approve the request as that user, you can return the user directly as `preloadedUser`. This is an optimized special case, because you're certifying that this is a user that already exists locally and you're returning their whole record.

`user`: in any other case, you should return a user object under the key `user`. At a minimum this can just have an `id`. Alternatively, if you're authenticating against a third party service this can be that service's representation of the user. In either case, the `user` will pass through any configured `userTemplate` to transform it into a form that is usable locally, then it will optionally be allowed to create or update a local user record.
