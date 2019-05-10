# @cardstack/routing

This README outlines the details of collaborating on this Ember addon.

## Installation

* `git clone <repository-url>` this repository
* `cd @cardstack/routing`
* `npm install`
* `bower install`

## Running

* `ember serve`
* Visit your app at [http://localhost:4200](http://localhost:4200).

## Running Tests

* `npm test` (Runs `ember try:each` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`

## Building

* `ember build`


# Design notes

Boundaries of the routing module:

 - provides a router map function that has routes for all your content
 - relies on store.{findRecord,query,createRecord}
    - you can duck-type the store if you don't want ember-data directly
 - expects you to have models 
    - named one-to-one with the logical routing names for your default branch
    - named with a branch prefix for non-default branches ("draft--articles" vs "articles")
    - with an optional static property "routingField" that causes URLs
      to be structured around something other than id
 - exposes helpers for 
     - modelName -> { logicalName, branch }
     - { logicalName, branch } -> modelName
 - provides a placeholder model that can be rendered for 404
   conditions, while maintaining enough state to shift branches
 - provides a transitionTo(logicalName, id, branch) function
 - provides a cardstack-href helper that maps { logicalType, id, branch } -> url. With a shorthand for also doing { model } -> url.
 - provides a cardstack-new-href helper that maps { logicalType, branch } -> url
 - has configurable defaultBranch and defaultContentType, but we can hard code those for the present
