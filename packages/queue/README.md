# Job queuing plugin for Cardstack

This plugin is for queueing jobs with cardstack hub. It uses [pg-boss](https://github.com/timgit/pg-boss) and
by extension, postgresql, to manage queued jobs,

# Required database configuration

The test suite is configured to talk to a PostgreSQL docker container. You can start it like:

    docker run --name cardstack-postgres -d --rm -p 5444:5432 cardstack/pg-test

And stop it like:

    docker stop cardstack-postgres


# API

Assuming you've looked up the queues feature from DI etc, e.g.

```js
let queue = env.lookup('hub:queues');
```

You can subscribe to a job by passing in a handler:

```js
queue.subscribe('my-job', handler, options);
```

Options are passed directly to pg boss.

Handlers can be sync or async:

```js
queue.subscribe('my-job', () => console.log("sync handler") );

queue.subscribe('my-job', () => { return new Promise() } );

queue.subscribe('my-job', async () => { await stuff(); console.log('done') });
```

You can then publish jobs to the named queues.

To publish without waiting for the job to complete, use the `publish` method:

```js
  let jobId = await queue.publish('my-job', {someDataForJob: 123}, options);
  // this line executes after the job gets to the db, but before it is executed
```
To publish and wait for the job to complete, use the `publishAndWait` method:

```js
  let jobResult = await queue.publishAndWait('my-job', {someDataForJob: 123}, options);
  // this line executes after the job is completed
```
