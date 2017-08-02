# PostgreSQL data source plugin for Cardstack

This plugin allows you to use a PostgreSQL database as storage for your Cardstack Hub server.

# Current Limitations

There's not yet any configuration for choosing which tables & columns will be included or how to rename them for use within the Hub. Therefore:
 - every table must have an `id` column and that column must be marked in PostgreSQL as the primary key.
 - you may not have a `type` column (your JSONAPI type comes from the table name)

# Required database configuration

I've been testing with PostgreSQL 9.6. Minimum PostgreSQL version is most likely 9.4.

To enable efficient incremental indexing of the database, we use [Logical Decoding](https://www.postgresql.org/docs/9.6/static/logicaldecoding.html), which means you will need to set the following in `postgresql.conf`:

    wal_level = logical
    max_replication_slots = 1  # Any number greater than 0 will work

