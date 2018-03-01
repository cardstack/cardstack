# PostgreSQL data source plugin for Cardstack

This plugin allows you to use a PostgreSQL database as storage for your Cardstack Hub server.

# Current Limitations

There's not yet any configuration for choosing which tables & columns will be included or how to rename them for use within the Hub. Therefore:
 - every table must have an `id` column and that column must be marked in PostgreSQL as the primary key.
 - the `id` must be of type `varchar` (all cardstack ids allow arbitrary alphanumeric strings)
 - if you want automatic id generation, you can use something like
   `create sequence article_id_seq; create table articles (id varchar primary key default cast(nextval('article_id_seq') as varchar));`
 - you may not have a `type` column (your JSONAPI type comes from the table name)
 - your column names must be globally unique throughout the Hub (this is always a requirement for Fields in the hub, and your column names are mapping one-to-one with fields)

# Required database configuration

I've been testing with PostgreSQL 9.6. Minimum PostgreSQL version is most likely 9.4.

To enable efficient incremental indexing of the database, we use [Logical Decoding](https://www.postgresql.org/docs/9.6/static/logicaldecoding.html), which means you will need to set the following in `postgresql.conf`:

    wal_level = logical
    max_replication_slots = 1  # Any number greater than 0 will work

If you are using AWS RDS, the AWS-specific setting you need in your parameter group is `rds.logical_replication`.

The test suite is configured to talk to a PostgreSQL docker container. You can start it like:

    docker run --name cardstack-postgres -d --rm -p 5444:5432 cardstack/pg-test

And stop it like:

    docker stop cardstack-postgres
