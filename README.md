# Cardstack

## Warning

Currently all embroider packages must be linked to the native-v2-addon branch of embroider.

## Installing

1. Install [volta](https://volta.sh/) and `volta install yarn`.
2. Clone the repo and run `yarn install`.
3. Install docker (we use it to launch supporting services like postgres).

## Orientation

`cardhost`: the Ember app
`server`: the server ("the hub")
`core`: shared code that is used by both cardhost and server
`base-cards`: the collection of framework-provided default cards that serve as the foundation for user-created cards
`demo-cards`: a collection of demo & test cards

## Architecture

By default, the server will use both the `base-cards` and `demo-cards` directories as read/write realms. Any change you make in the app will appear as (uncommitted) changes to these directories.

The server maintains its own search index over all the realms it knows about. The search index is stored in postgres.

## Open Questions

1. Are types really agnostic to value vs reference of their fields? If you could bake one or the other into the type, it makes it easier to write code in the card that touches (particularly for edit) all value data no matter how deep.

  Setting this at instance-creation time seems too late. It really seems like policy at a higher level.

  Multiple levels possible:
    - singular value (body)
    - plural value (string tags could be this)
    - singular hand-picked reference (author)
    - singular query-driven reference (spotlight on the homepage)
    - plural hand-picked references (tags as actual entities)
    - plural query-driven references (comments)

  Are these six the six implementations, or are they also the actual types in the schema, or are some of these actually interchangeable types?
    - singular vs plural must be part of type
    - probably value vs reference must be part of type
    - hand-picked vs query may *not* need to be part of type


# field API naming

 - `contains`: singular, value
 - `containsMany`: plural, value
 - `belongsTo`: singular, reference
   - can hold either query or explicit list of ids
 - `hasMany`: plural, reference
   - can hold either query or explicit list of ids


# Naming things in our Compiler API

`schema.js`: the card's Schema Definition
```ts
async compile(schemaDefinition, templates): Promise<Model, Component[]>
```

`Model`: is the runtime module that you can interrogate about the card's schema and data requirements.