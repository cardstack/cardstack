# Computed values and dynamic relationships

## Notes from [PR Discussion](https://github.com/cardstack/cardstack/pull/2361)

Discussion points as we figure out next steps:

    We need to implement the Builder interface such that it's backed by the search index.
        this gives us caching again
        this lets us eliminate redundant pre-indexing card cache capabilities
    Challenge: we probably need inter-card invalidations right away, because indexing can't know one perfect card dependency order.
    Challenge: the module defining features of the current card-cache are still needed (writing files that are visible to webpack and requirable by node).
    The invalidation system needs to be able to target from one card to other cards and specific fields in other cards.
    The reindexing / card compiling process needs to accept a list of invalidations (down to the field level) as an input so that it knows which parts can be left alone and which should be touched.
        this may be something we can control at the Builder level rather than the Compiler level because it decides what to give back for getRawCard and getCompiledCard. But that might require making those APIs more field-level aware.
        this is one place where we can choose to control versioning / snapshotting. This is under-designed but that's OK for now.
    The index needs to represent error states for cards, and we need to figure out ways to shows those usefully to developers (as well as automatically resolve them when dependencies change and cause a card to unbreak).

Next actions:

    add a dependency column to the cards table that's capable of representing "I depend on card X, all fields" and "I depend card X, specific field".
    add a test that:
        indexes a realm with a card with a broken dependency
        sees the broken card giving a helpful error message (cardService.load throwing a good exception, which means API endpoint would also give helpful error response)
        uses cardService.create to provide the missing dependency
        sees that the original card is no longer broken (and we didn't need to do anything manual to get it to reindex)
    at this point we can make the builder rely entirely on the search index

More todos as we discover them:

- [ ] move realm config into container, eliminating need for imperative `createRealm()`
- [ ] implement `beginReplaceAll` and `endReplaceAll` and use them in the fs realm indexer, and then get rid of double `si.reset()` in test setup.
- [ ] eliminate eager creation of card service in setupHub, in favor of layered separate setup functions, once of which gives you a synchronous card service.
- [ ] update `lookupFieldsForCard` to throw context-sensitive errors in the same way that we did for `getParentCard`
- [ ] bug: ensure relative card lookups within the compiler always treat card's own URL as a directory and go up from there
- [ ] compiler should be able to run against unsaved card:
  - [ ] `CompiledCard` should contain the defined modules instead of defining them by side effect
  - [ ] relative lookups can use realm but not full cardURL
  - [ ] this will let us break up compiling and indexing during CRUD operations, so we can validate before saving to realm and save to realm before saving to index.
  - [ ] this will make it clearer where we need to catch compile errors during indexing and not catch them during CRUD operations

# Original Notes from 2021-09-21

- [Computed values and dynamic relationships](#computed-values-and-dynamic-relationships)
  - [Taxonomy of Fields](#taxonomy-of-fields)
  - [Prioritization](#prioritization)
    - [LinksTo\* Breakdown](#linksto-breakdown)
    - [Card Chooser UI as Motivating Use Case for Query System](#card-chooser-ui-as-motivating-use-case-for-query-system)
  - [Further API Design decisions](#further-api-design-decisions)
  - [Defered Features](#defered-features)
  - [Open Questions/Strings to pull](#open-questionsstrings-to-pull)

## Taxonomy of Fields

| Name         | Arity    | Value/Ref finds                  | Status                      |
| ------------ | -------- | -------------------------------- | --------------------------- |
| containsOne  | singular | value                            | implemented with basic UI   |
| containsMany | plural   | value                            | compiler implemented, no UI |
| linksToOne   | singular | reference via locally stored ID  |                             |
| linksToMany  | plural   | reference via locally stored IDs |                             |
| findsOne     | singular | reference via query              |                             |
| findsMany    | plural   | reference via query              |                             |

**Why we probably need to distinguish between "list of ids" and "query":**

- they support different mutations (to support mutation on query you would need spooky action at a distance)
- very different UI
- permissions are quite different depending on which side owns the data

**What is the separation between schema-layer concerns and data-layer concerns?**

- often, setting up a query is a schema-layer policy decision and then individual records shouldn't really change it
- this supports the idea that storing query vs storing IDs is a schema choice (as described in previous section)
- is there ever a need to manipulate queries at the data layer? (working theory: no, lets skip it for the present)

**choices on relationships**

- ordering / sorting (manual order is often important. Sometimes people will want an imposed ordering.)
- pagination / infinite scroll
- are individual viewers allowed to customize ordering or pagination?

**Doubly indirect relationships**

- the point of references is to use existing data, not make new copies
- but sometimes the existing data you want to reuse is itself a Collection
- "doubly indirect" because you first lookup the query and/or list of ids, and then use the ids to lookup the records
  - these may be two different things depending on whether you "first lookup the query" or "first lookup the list of ids"
- this can probably surface to users as some kind of first-class Collection concept
- is this a completely distinct type of relationship, or can you encode it as "plural referenced via query"

## Prioritization

- to do findsOne and findsMany we need to do query system
- to do query system we probably need to do indexing
- we could do linksToOne and linksToMany first
  - but the card chooser itself also needs query system (can stub at first)

### LinksTo\* Breakdown

See: [CS-1808](https://linear.app/cardstack/issue/CS-1808/linkstoone-fields)
See: [CS-1809](https://linear.app/cardstack/issue/CS-1809/linkstoone-fields)

- make syntax work in schema.js so you can declare these things
- write or update a create card tests for a card that has these things
- get a basic placeholder component into place in the edit view
  - offer to choose or create
  - create implies stack-like routing into the existing create-new-card experience
  - choose implies implementing a framework-provided card browser with type filtering capability
  - implementing chooser requires implementing queries
- related cards go into server response (they are json:api relationships with included resources)
  - does this imply query system? (no, it's not an arbitrary query, just IDs which we already support)
- client side deserializer needs to know how to take the json:api relationships and put them into our POJO structure that gets handed to the user's component

### Card Chooser UI as Motivating Use Case for Query System

See: [CS-77](https://linear.app/cardstack/issue/CS-77/basic-card-chooser)

- invoked with a Query that scopes down what you're searching for
- is kinda "modal" ish, maybe a tray that opens from the bottom
- can be launched with Query limiting to right type when the clicks "Choose an
  author..." button on the edit form of a card
  - (later could also be manually opened more like Finder, and support dragging cards into fields)
- is backed by searches, search is a new method on the cards service that takes a Query
- search method is implemented via new API endpoint(s) and/or query params on compiler-server
- the new API endpoints execute queries against the search index in postgres
- first we can implement single-pass at-startup index all the cards into postgres
  - then we can worry about incremental update and invalidations

## Further API Design decisions

We need to figure out the overlap of functionality between computeds and dynamic relationships. Are dynamic relationships just computeds with some extra sugar?

- Schema.js - How computed and relationships are declared
  - [ ] How will computeds be written?
  - [ ] Will any of the field inclusion types require special options?
- Components Templates - How computeds and relationships are invoked
  - [ ] The HBS api
  - [ ] What this actually does when compiled. Wrapper components?
- Arbitrary JS access to dynamic computed/relationship data
  - [ ] API for fetching missing relationships
  - [ ] WHat are the implications for client vs server side computeds?
- Modal stacking (ie: Open this post's author in edit view)
- Framework components for managing collections (ie: adding/removing ContainsMany/HasMany fields)

## Defered Features

- Caching/Index invalidation
- Pagination
- Declarative configuration of how data is loaded (ie: Dont load this Post's comments until the component is on screen)

## Open Questions/Strings to pull

- [ ] Polymorphic relationships?
- [ ] Consider blockchain transaction indexing - Hassan has knowledge
- [ ] Consider music registry examples - Burcu has knowledge
- [ ] Generate some basic prose on the design decisions for Chris to use in the community
- [ ] See "Doubly indirect relationships" info above
