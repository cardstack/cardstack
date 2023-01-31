--
-- PostgreSQL database dump
--

-- Dumped from database version 14.1
-- Dumped by pg_dump version 15.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: graphile_worker; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA graphile_worker;


ALTER SCHEMA graphile_worker OWNER TO postgres;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: card_dep; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.card_dep AS (
	url text,
	deps text[]
);


ALTER TYPE public.card_dep OWNER TO postgres;

--
-- Name: discord_bots_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.discord_bots_status_enum AS ENUM (
    'connecting',
    'connected',
    'listening',
    'disconnected',
    'unresponsive'
);


ALTER TYPE public.discord_bots_status_enum OWNER TO postgres;

--
-- Name: gas_estimation_results_scenario_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.gas_estimation_results_scenario_enum AS ENUM (
    'create_safe_with_module',
    'execute_one_time_payment',
    'execute_recurring_payment'
);


ALTER TYPE public.gas_estimation_results_scenario_enum OWNER TO postgres;

--
-- Name: notification_preferences_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_preferences_status_enum AS ENUM (
    'enabled',
    'disabled'
);


ALTER TYPE public.notification_preferences_status_enum OWNER TO postgres;

--
-- Name: notification_types_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_types_status_enum AS ENUM (
    'enabled',
    'disabled'
);


ALTER TYPE public.notification_types_status_enum OWNER TO postgres;

--
-- Name: scheduled_payment_attempts_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.scheduled_payment_attempts_status_enum AS ENUM (
    'in_progress',
    'succeeded',
    'failed'
);


ALTER TYPE public.scheduled_payment_attempts_status_enum OWNER TO postgres;

--
-- Name: wallet_orders_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.wallet_orders_status_enum AS ENUM (
    'waiting-for-order',
    'received-order',
    'waiting-for-reservation',
    'provisioning',
    'error-provisioning',
    'complete'
);


ALTER TYPE public.wallet_orders_status_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: jobs; Type: TABLE; Schema: graphile_worker; Owner: postgres
--

CREATE TABLE graphile_worker.jobs (
    id bigint NOT NULL,
    queue_name text DEFAULT (public.gen_random_uuid())::text,
    task_identifier text NOT NULL,
    payload json DEFAULT '{}'::json NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 25 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text,
    locked_at timestamp with time zone,
    locked_by text,
    revision integer DEFAULT 0 NOT NULL,
    flags jsonb,
    CONSTRAINT jobs_key_check CHECK ((length(key) > 0))
);


ALTER TABLE graphile_worker.jobs OWNER TO postgres;

--
-- Name: add_job(text, json, text, timestamp with time zone, integer, text, integer, text[], text); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.add_job(identifier text, payload json DEFAULT NULL::json, queue_name text DEFAULT NULL::text, run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, max_attempts integer DEFAULT NULL::integer, job_key text DEFAULT NULL::text, priority integer DEFAULT NULL::integer, flags text[] DEFAULT NULL::text[], job_key_mode text DEFAULT 'replace'::text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_job graphile_worker.jobs;
begin
  -- Apply rationality checks
  if length(identifier) > 128 then
    raise exception 'Task identifier is too long (max length: 128).' using errcode = 'GWBID';
  end if;
  if queue_name is not null and length(queue_name) > 128 then
    raise exception 'Job queue name is too long (max length: 128).' using errcode = 'GWBQN';
  end if;
  if job_key is not null and length(job_key) > 512 then
    raise exception 'Job key is too long (max length: 512).' using errcode = 'GWBJK';
  end if;
  if max_attempts < 1 then
    raise exception 'Job maximum attempts must be at least 1.' using errcode = 'GWBMA';
  end if;
  if job_key is not null and (job_key_mode is null or job_key_mode in ('replace', 'preserve_run_at')) then
    -- Upsert job if existing job isn't locked, but in the case of locked
    -- existing job create a new job instead as it must have already started
    -- executing (i.e. it's world state is out of date, and the fact add_job
    -- has been called again implies there's new information that needs to be
    -- acted upon).
    insert into graphile_worker.jobs (
      task_identifier,
      payload,
      queue_name,
      run_at,
      max_attempts,
      key,
      priority,
      flags
    )
      values(
        identifier,
        coalesce(payload, '{}'::json),
        queue_name,
        coalesce(run_at, now()),
        coalesce(max_attempts, 25),
        job_key,
        coalesce(priority, 0),
        (
          select jsonb_object_agg(flag, true)
          from unnest(flags) as item(flag)
        )
      )
      on conflict (key) do update set
        task_identifier=excluded.task_identifier,
        payload=excluded.payload,
        queue_name=excluded.queue_name,
        max_attempts=excluded.max_attempts,
        run_at=(case
          when job_key_mode = 'preserve_run_at' and jobs.attempts = 0 then jobs.run_at
          else excluded.run_at
        end),
        priority=excluded.priority,
        revision=jobs.revision + 1,
        flags=excluded.flags,
        -- always reset error/retry state
        attempts=0,
        last_error=null
      where jobs.locked_at is null
      returning *
      into v_job;
    -- If upsert succeeded (insert or update), return early
    if not (v_job is null) then
      return v_job;
    end if;
    -- Upsert failed -> there must be an existing job that is locked. Remove
    -- existing key to allow a new one to be inserted, and prevent any
    -- subsequent retries of existing job by bumping attempts to the max
    -- allowed.
    update graphile_worker.jobs
      set
        key = null,
        attempts = jobs.max_attempts
      where key = job_key;
  elsif job_key is not null and job_key_mode = 'unsafe_dedupe' then
    -- Insert job, but if one already exists then do nothing, even if the
    -- existing job has already started (and thus represents an out-of-date
    -- world state). This is dangerous because it means that whatever state
    -- change triggered this add_job may not be acted upon (since it happened
    -- after the existing job started executing, but no further job is being
    -- scheduled), but it is useful in very rare circumstances for
    -- de-duplication. If in doubt, DO NOT USE THIS.
    insert into graphile_worker.jobs (
      task_identifier,
      payload,
      queue_name,
      run_at,
      max_attempts,
      key,
      priority,
      flags
    )
      values(
        identifier,
        coalesce(payload, '{}'::json),
        queue_name,
        coalesce(run_at, now()),
        coalesce(max_attempts, 25),
        job_key,
        coalesce(priority, 0),
        (
          select jsonb_object_agg(flag, true)
          from unnest(flags) as item(flag)
        )
      )
      on conflict (key)
      -- Bump the revision so that there's something to return
      do update set revision = jobs.revision + 1
      returning *
      into v_job;
    return v_job;
  elsif job_key is not null then
    raise exception 'Invalid job_key_mode value, expected ''replace'', ''preserve_run_at'' or ''unsafe_dedupe''.' using errcode = 'GWBKM';
  end if;
  -- insert the new job. Assume no conflicts due to the update above
  insert into graphile_worker.jobs(
    task_identifier,
    payload,
    queue_name,
    run_at,
    max_attempts,
    key,
    priority,
    flags
  )
    values(
      identifier,
      coalesce(payload, '{}'::json),
      queue_name,
      coalesce(run_at, now()),
      coalesce(max_attempts, 25),
      job_key,
      coalesce(priority, 0),
      (
        select jsonb_object_agg(flag, true)
        from unnest(flags) as item(flag)
      )
    )
    returning *
    into v_job;
  return v_job;
end;
$$;


ALTER FUNCTION graphile_worker.add_job(identifier text, payload json, queue_name text, run_at timestamp with time zone, max_attempts integer, job_key text, priority integer, flags text[], job_key_mode text) OWNER TO postgres;

--
-- Name: complete_job(text, bigint); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.complete_job(worker_id text, job_id bigint) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_row graphile_worker.jobs;
begin
  delete from graphile_worker.jobs
    where id = job_id
    returning * into v_row;

  if v_row.queue_name is not null then
    update graphile_worker.job_queues
      set locked_by = null, locked_at = null
      where queue_name = v_row.queue_name and locked_by = worker_id;
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION graphile_worker.complete_job(worker_id text, job_id bigint) OWNER TO postgres;

--
-- Name: complete_jobs(bigint[]); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.complete_jobs(job_ids bigint[]) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  delete from graphile_worker.jobs
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


ALTER FUNCTION graphile_worker.complete_jobs(job_ids bigint[]) OWNER TO postgres;

--
-- Name: fail_job(text, bigint, text); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.fail_job(worker_id text, job_id bigint, error_message text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql STRICT
    AS $$
declare
  v_row graphile_worker.jobs;
begin
  update graphile_worker.jobs
    set
      last_error = error_message,
      run_at = greatest(now(), run_at) + (exp(least(attempts, 10))::text || ' seconds')::interval,
      locked_by = null,
      locked_at = null
    where id = job_id and locked_by = worker_id
    returning * into v_row;

  if v_row.queue_name is not null then
    update graphile_worker.job_queues
      set locked_by = null, locked_at = null
      where queue_name = v_row.queue_name and locked_by = worker_id;
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION graphile_worker.fail_job(worker_id text, job_id bigint, error_message text) OWNER TO postgres;

--
-- Name: get_job(text, text[], interval, text[]); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.get_job(worker_id text, task_identifiers text[] DEFAULT NULL::text[], job_expiry interval DEFAULT '04:00:00'::interval, forbidden_flags text[] DEFAULT NULL::text[]) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_job_id bigint;
  v_queue_name text;
  v_row graphile_worker.jobs;
  v_now timestamptz = now();
begin
  if worker_id is null or length(worker_id) < 10 then
    raise exception 'invalid worker id';
  end if;

  select jobs.queue_name, jobs.id into v_queue_name, v_job_id
    from graphile_worker.jobs
    where (jobs.locked_at is null or jobs.locked_at < (v_now - job_expiry))
    and (
      jobs.queue_name is null
    or
      exists (
        select 1
        from graphile_worker.job_queues
        where job_queues.queue_name = jobs.queue_name
        and (job_queues.locked_at is null or job_queues.locked_at < (v_now - job_expiry))
        for update
        skip locked
      )
    )
    and run_at <= v_now
    and attempts < max_attempts
    and (task_identifiers is null or task_identifier = any(task_identifiers))
    and (forbidden_flags is null or (flags ?| forbidden_flags) is not true)
    order by priority asc, run_at asc, id asc
    limit 1
    for update
    skip locked;

  if v_job_id is null then
    return null;
  end if;

  if v_queue_name is not null then
    update graphile_worker.job_queues
      set
        locked_by = worker_id,
        locked_at = v_now
      where job_queues.queue_name = v_queue_name;
  end if;

  update graphile_worker.jobs
    set
      attempts = attempts + 1,
      locked_by = worker_id,
      locked_at = v_now
    where id = v_job_id
    returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION graphile_worker.get_job(worker_id text, task_identifiers text[], job_expiry interval, forbidden_flags text[]) OWNER TO postgres;

--
-- Name: jobs__decrease_job_queue_count(); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.jobs__decrease_job_queue_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_new_job_count int;
begin
  update graphile_worker.job_queues
    set job_count = job_queues.job_count - 1
    where queue_name = old.queue_name
    returning job_count into v_new_job_count;

  if v_new_job_count <= 0 then
    delete from graphile_worker.job_queues where queue_name = old.queue_name and job_count <= 0;
  end if;

  return old;
end;
$$;


ALTER FUNCTION graphile_worker.jobs__decrease_job_queue_count() OWNER TO postgres;

--
-- Name: jobs__increase_job_queue_count(); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.jobs__increase_job_queue_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into graphile_worker.job_queues(queue_name, job_count)
    values(new.queue_name, 1)
    on conflict (queue_name)
    do update
    set job_count = job_queues.job_count + 1;

  return new;
end;
$$;


ALTER FUNCTION graphile_worker.jobs__increase_job_queue_count() OWNER TO postgres;

--
-- Name: permanently_fail_jobs(bigint[], text); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.permanently_fail_jobs(job_ids bigint[], error_message text DEFAULT NULL::text) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  update graphile_worker.jobs
    set
      last_error = coalesce(error_message, 'Manually marked as failed'),
      attempts = max_attempts
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


ALTER FUNCTION graphile_worker.permanently_fail_jobs(job_ids bigint[], error_message text) OWNER TO postgres;

--
-- Name: remove_job(text); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.remove_job(job_key text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql STRICT
    AS $$
declare
  v_job graphile_worker.jobs;
begin
  -- Delete job if not locked
  delete from graphile_worker.jobs
    where key = job_key
    and locked_at is null
  returning * into v_job;
  if not (v_job is null) then
    return v_job;
  end if;
  -- Otherwise prevent job from retrying, and clear the key
  update graphile_worker.jobs
    set attempts = max_attempts, key = null
    where key = job_key
  returning * into v_job;
  return v_job;
end;
$$;


ALTER FUNCTION graphile_worker.remove_job(job_key text) OWNER TO postgres;

--
-- Name: reschedule_jobs(bigint[], timestamp with time zone, integer, integer, integer); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.reschedule_jobs(job_ids bigint[], run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, priority integer DEFAULT NULL::integer, attempts integer DEFAULT NULL::integer, max_attempts integer DEFAULT NULL::integer) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  update graphile_worker.jobs
    set
      run_at = coalesce(reschedule_jobs.run_at, jobs.run_at),
      priority = coalesce(reschedule_jobs.priority, jobs.priority),
      attempts = coalesce(reschedule_jobs.attempts, jobs.attempts),
      max_attempts = coalesce(reschedule_jobs.max_attempts, jobs.max_attempts)
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


ALTER FUNCTION graphile_worker.reschedule_jobs(job_ids bigint[], run_at timestamp with time zone, priority integer, attempts integer, max_attempts integer) OWNER TO postgres;

--
-- Name: tg__update_timestamp(); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.tg__update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = greatest(now(), old.updated_at + interval '1 millisecond');
  return new;
end;
$$;


ALTER FUNCTION graphile_worker.tg__update_timestamp() OWNER TO postgres;

--
-- Name: tg_jobs__notify_new_jobs(); Type: FUNCTION; Schema: graphile_worker; Owner: postgres
--

CREATE FUNCTION graphile_worker.tg_jobs__notify_new_jobs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify('jobs:insert', '');
  return new;
end;
$$;


ALTER FUNCTION graphile_worker.tg_jobs__notify_new_jobs() OWNER TO postgres;

--
-- Name: card_eq(public.card_dep, public.card_dep); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.card_eq(public.card_dep, public.card_dep) RETURNS boolean
    LANGUAGE sql
    AS $_$select deps_cmp($1, $2) = 0;$_$;


ALTER FUNCTION public.card_eq(public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: card_gt(public.card_dep, public.card_dep); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.card_gt(public.card_dep, public.card_dep) RETURNS boolean
    LANGUAGE sql
    AS $_$select deps_cmp($1, $2) > 0;$_$;


ALTER FUNCTION public.card_gt(public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: card_lt(public.card_dep, public.card_dep); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.card_lt(public.card_dep, public.card_dep) RETURNS boolean
    LANGUAGE sql
    AS $_$select deps_cmp($1, $2) < 0;$_$;


ALTER FUNCTION public.card_lt(public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: deps_cmp(public.card_dep, public.card_dep); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.deps_cmp(public.card_dep, public.card_dep) RETURNS integer
    LANGUAGE sql
    AS $_$
    select case
      when $1.url = any($2.deps)
        then 1
      when $2.url = any($1.deps)
        then -1
      else
        case
          when $1.url < $2.url
            then -1
          when $2.url < $1.url
            then 1
          else
            0
          end
      end
    ;
  $_$;


ALTER FUNCTION public.deps_cmp(public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: discord_bots_updated_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.discord_bots_updated_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      payload TEXT;
    BEGIN
    IF NEW."last_message_id" IS NOT NULL THEN
      payload := '{ "id": "' || NEW."last_message_id" || '", "bot_type": "' || NEW."bot_type" || '" }';
      PERFORM pg_notify('discord_bot_message_processing', payload);
    END IF;
    IF OLD."status" = 'listening' AND NEW."status" = 'disconnected' THEN
      payload := '{ "bot_type": "' || NEW."bot_type" || '", "status": "' || NEW."status"   ||'" }';
      PERFORM pg_notify('discord_bot_status', payload);
    END IF;
    RETURN NEW;
  END
  $$;


ALTER FUNCTION public.discord_bots_updated_trigger() OWNER TO postgres;

--
-- Name: <^; Type: OPERATOR; Schema: public; Owner: postgres
--

CREATE OPERATOR public.<^ (
    FUNCTION = public.card_lt,
    LEFTARG = public.card_dep,
    RIGHTARG = public.card_dep
);


ALTER OPERATOR public.<^ (public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: >^; Type: OPERATOR; Schema: public; Owner: postgres
--

CREATE OPERATOR public.>^ (
    FUNCTION = public.card_gt,
    LEFTARG = public.card_dep,
    RIGHTARG = public.card_dep
);


ALTER OPERATOR public.>^ (public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: ?-; Type: OPERATOR; Schema: public; Owner: postgres
--

CREATE OPERATOR public.?- (
    FUNCTION = public.card_eq,
    LEFTARG = public.card_dep,
    RIGHTARG = public.card_dep
);


ALTER OPERATOR public.?- (public.card_dep, public.card_dep) OWNER TO postgres;

--
-- Name: card_fam; Type: OPERATOR FAMILY; Schema: public; Owner: postgres
--

CREATE OPERATOR FAMILY public.card_fam USING btree;


ALTER OPERATOR FAMILY public.card_fam USING btree OWNER TO postgres;

--
-- Name: card_ops; Type: OPERATOR CLASS; Schema: public; Owner: postgres
--

CREATE OPERATOR CLASS public.card_ops
    FOR TYPE public.card_dep USING btree FAMILY public.card_fam AS
    OPERATOR 1 public.<^(public.card_dep,public.card_dep) ,
    OPERATOR 3 public.?-(public.card_dep,public.card_dep) ,
    OPERATOR 5 public.>^(public.card_dep,public.card_dep) ,
    FUNCTION 1 (public.card_dep, public.card_dep) public.deps_cmp(public.card_dep,public.card_dep);


ALTER OPERATOR CLASS public.card_ops USING btree OWNER TO postgres;

--
-- Name: job_queues; Type: TABLE; Schema: graphile_worker; Owner: postgres
--

CREATE TABLE graphile_worker.job_queues (
    queue_name text NOT NULL,
    job_count integer NOT NULL,
    locked_at timestamp with time zone,
    locked_by text
);


ALTER TABLE graphile_worker.job_queues OWNER TO postgres;

--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: graphile_worker; Owner: postgres
--

CREATE SEQUENCE graphile_worker.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE graphile_worker.jobs_id_seq OWNER TO postgres;

--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: graphile_worker; Owner: postgres
--

ALTER SEQUENCE graphile_worker.jobs_id_seq OWNED BY graphile_worker.jobs.id;


--
-- Name: known_crontabs; Type: TABLE; Schema: graphile_worker; Owner: postgres
--

CREATE TABLE graphile_worker.known_crontabs (
    identifier text NOT NULL,
    known_since timestamp with time zone NOT NULL,
    last_execution timestamp with time zone
);


ALTER TABLE graphile_worker.known_crontabs OWNER TO postgres;

--
-- Name: migrations; Type: TABLE; Schema: graphile_worker; Owner: postgres
--

CREATE TABLE graphile_worker.migrations (
    id integer NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE graphile_worker.migrations OWNER TO postgres;

--
-- Name: card_drop_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.card_drop_recipients (
    user_id text NOT NULL,
    user_name text NOT NULL,
    address text,
    airdrop_txn_hash text,
    airdrop_prepaid_card text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.card_drop_recipients OWNER TO postgres;

--
-- Name: cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cards (
    url text NOT NULL,
    data jsonb,
    ancestors text[],
    "searchData" jsonb,
    realm text NOT NULL,
    generation integer,
    "compileErrors" jsonb,
    deps text[],
    raw jsonb,
    compiled jsonb,
    "schemaModule" text,
    "componentInfos" jsonb
);


ALTER TABLE public.cards OWNER TO postgres;

--
-- Name: crank_nonces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crank_nonces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id integer NOT NULL,
    nonce bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.crank_nonces OWNER TO postgres;

--
-- Name: discord_bots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_bots (
    bot_id text NOT NULL,
    bot_type text NOT NULL,
    status public.discord_bots_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_message_id text
);


ALTER TABLE public.discord_bots OWNER TO postgres;

--
-- Name: dm_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dm_channels (
    channel_id text NOT NULL,
    user_id text NOT NULL,
    command text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.dm_channels OWNER TO postgres;

--
-- Name: email_card_drop_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_card_drop_requests (
    id uuid NOT NULL,
    owner_address text NOT NULL,
    email_hash text NOT NULL,
    verification_code text NOT NULL,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    claimed_at timestamp without time zone,
    transaction_hash text
);


ALTER TABLE public.email_card_drop_requests OWNER TO postgres;

--
-- Name: email_card_drop_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_card_drop_state (
    id integer DEFAULT 1 NOT NULL,
    rate_limited boolean NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT email_card_drop_state_singleton CHECK ((id = 1))
);


ALTER TABLE public.email_card_drop_state OWNER TO postgres;

--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_rates (
    date date NOT NULL,
    from_symbol text NOT NULL,
    to_symbol text NOT NULL,
    exchange text NOT NULL,
    rate numeric NOT NULL
);


ALTER TABLE public.exchange_rates OWNER TO postgres;

--
-- Name: gas_estimation_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gas_estimation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id integer NOT NULL,
    scenario public.gas_estimation_results_scenario_enum NOT NULL,
    gas integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.gas_estimation_results OWNER TO postgres;

--
-- Name: gas_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gas_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id integer NOT NULL,
    slow text NOT NULL,
    standard text NOT NULL,
    fast text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.gas_prices OWNER TO postgres;

--
-- Name: job_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_tickets (
    id uuid NOT NULL,
    job_type text NOT NULL,
    owner_address text NOT NULL,
    payload jsonb,
    result jsonb,
    state text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    spec jsonb,
    source_arguments jsonb
);


ALTER TABLE public.job_tickets OWNER TO postgres;

--
-- Name: latest_event_block; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.latest_event_block (
    id integer DEFAULT 1 NOT NULL,
    block_number integer NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT latest_event_block_singleton CHECK ((id = 1))
);


ALTER TABLE public.latest_event_block OWNER TO postgres;

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    owner_address text NOT NULL,
    notification_type_id uuid NOT NULL,
    push_client_id text NOT NULL,
    status public.notification_preferences_status_enum DEFAULT 'enabled'::public.notification_preferences_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: notification_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_types (
    id uuid NOT NULL,
    notification_type text NOT NULL,
    default_status public.notification_types_status_enum DEFAULT 'enabled'::public.notification_types_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notification_types OWNER TO postgres;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: prepaid_card_color_schemes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prepaid_card_color_schemes (
    id uuid NOT NULL,
    background text NOT NULL,
    pattern_color text NOT NULL,
    text_color text NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.prepaid_card_color_schemes OWNER TO postgres;

--
-- Name: prepaid_card_customizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prepaid_card_customizations (
    id uuid NOT NULL,
    owner_address text NOT NULL,
    issuer_name text NOT NULL,
    color_scheme_id uuid NOT NULL,
    pattern_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.prepaid_card_customizations OWNER TO postgres;

--
-- Name: prepaid_card_patterns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prepaid_card_patterns (
    id uuid NOT NULL,
    pattern_url text,
    description text NOT NULL
);


ALTER TABLE public.prepaid_card_patterns OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text NOT NULL,
    text_color text NOT NULL,
    owner_address text NOT NULL,
    links json[] DEFAULT '{}'::json[] NOT NULL,
    profile_image_url text,
    profile_description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: push_notification_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_notification_registrations (
    id uuid NOT NULL,
    owner_address text NOT NULL,
    push_client_id text NOT NULL,
    disabled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.push_notification_registrations OWNER TO postgres;

--
-- Name: realm_metas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.realm_metas (
    realm text NOT NULL,
    meta jsonb
);


ALTER TABLE public.realm_metas OWNER TO postgres;

--
-- Name: reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_address text NOT NULL,
    sku text NOT NULL,
    transaction_hash text,
    prepaid_card_address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.reservations OWNER TO postgres;

--
-- Name: reward_proofs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_proofs (
    reward_program_id text NOT NULL,
    payee text NOT NULL,
    leaf text NOT NULL,
    payment_cycle integer NOT NULL,
    proof_bytes text[] NOT NULL,
    token_type integer NOT NULL,
    valid_from integer NOT NULL,
    valid_to integer NOT NULL,
    explanation_id text,
    explanation_data json
);


ALTER TABLE public.reward_proofs OWNER TO postgres;

--
-- Name: reward_root_index; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_root_index (
    reward_program_id text NOT NULL,
    payment_cycle integer NOT NULL,
    block_number integer NOT NULL
);


ALTER TABLE public.reward_root_index OWNER TO postgres;

--
-- Name: scheduled_payment_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_payment_attempts (
    id uuid NOT NULL,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    status public.scheduled_payment_attempts_status_enum DEFAULT 'in_progress'::public.scheduled_payment_attempts_status_enum NOT NULL,
    transaction_hash text,
    failure_reason text,
    scheduled_payment_id uuid NOT NULL
);


ALTER TABLE public.scheduled_payment_attempts OWNER TO postgres;

--
-- Name: scheduled_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_payments (
    id uuid NOT NULL,
    sender_safe_address text NOT NULL,
    module_address text NOT NULL,
    token_address text NOT NULL,
    amount text NOT NULL,
    payee_address text NOT NULL,
    execution_gas_estimation integer NOT NULL,
    max_gas_price text NOT NULL,
    fee_fixed_usd numeric NOT NULL,
    fee_percentage numeric NOT NULL,
    salt text NOT NULL,
    pay_at timestamp without time zone,
    recurring_day_of_month integer,
    recurring_until timestamp without time zone,
    valid_for_days integer DEFAULT 3,
    sp_hash text NOT NULL,
    chain_id integer NOT NULL,
    creation_transaction_hash text,
    creation_block_number integer,
    cancelation_transaction_hash text,
    cancelation_block_number integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    canceled_at timestamp without time zone,
    user_address text NOT NULL,
    creation_transaction_error text,
    cancelation_transaction_error text,
    gas_token_address text NOT NULL
);


ALTER TABLE public.scheduled_payments OWNER TO postgres;

--
-- Name: sent_push_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sent_push_notifications (
    notification_id text NOT NULL,
    push_client_id text,
    notification_type text,
    notification_title text,
    notification_body text,
    notification_data json,
    message_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sent_push_notifications OWNER TO postgres;

--
-- Name: uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploads (
    id uuid NOT NULL,
    cid text NOT NULL,
    service text NOT NULL,
    url text NOT NULL,
    filename text NOT NULL,
    size integer NOT NULL,
    type text NOT NULL,
    owner_address text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.uploads OWNER TO postgres;

--
-- Name: wallet_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_orders (
    order_id text NOT NULL,
    user_address text NOT NULL,
    wallet_id text NOT NULL,
    status public.wallet_orders_status_enum NOT NULL,
    custodial_transfer_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reservation_id uuid
);


ALTER TABLE public.wallet_orders OWNER TO postgres;

--
-- Name: wyre_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wyre_prices (
    sku text NOT NULL,
    source_currency text NOT NULL,
    dest_currency text NOT NULL,
    source_currency_price numeric NOT NULL,
    includes_fee boolean DEFAULT false NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wyre_prices OWNER TO postgres;

--
-- Name: jobs id; Type: DEFAULT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.jobs ALTER COLUMN id SET DEFAULT nextval('graphile_worker.jobs_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: job_queues job_queues_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.job_queues
    ADD CONSTRAINT job_queues_pkey PRIMARY KEY (queue_name);


--
-- Name: jobs jobs_key_key; Type: CONSTRAINT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.jobs
    ADD CONSTRAINT jobs_key_key UNIQUE (key);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: known_crontabs known_crontabs_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.known_crontabs
    ADD CONSTRAINT known_crontabs_pkey PRIMARY KEY (identifier);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE ONLY graphile_worker.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: card_drop_recipients card_drop_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_drop_recipients
    ADD CONSTRAINT card_drop_recipients_pkey PRIMARY KEY (user_id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (url);


--
-- Name: crank_nonces crank_nonces_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crank_nonces
    ADD CONSTRAINT crank_nonces_chain_id_key UNIQUE (chain_id);


--
-- Name: crank_nonces crank_nonces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crank_nonces
    ADD CONSTRAINT crank_nonces_pkey PRIMARY KEY (id);


--
-- Name: discord_bots discord_bots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_bots
    ADD CONSTRAINT discord_bots_pkey PRIMARY KEY (bot_id);


--
-- Name: dm_channels dm_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dm_channels
    ADD CONSTRAINT dm_channels_pkey PRIMARY KEY (channel_id);


--
-- Name: email_card_drop_requests email_card_drop_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_card_drop_requests
    ADD CONSTRAINT email_card_drop_requests_pkey PRIMARY KEY (id);


--
-- Name: email_card_drop_state email_card_drop_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_card_drop_state
    ADD CONSTRAINT email_card_drop_state_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (date, from_symbol, to_symbol, exchange);


--
-- Name: gas_estimation_results gas_estimation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gas_estimation_results
    ADD CONSTRAINT gas_estimation_results_pkey PRIMARY KEY (id);


--
-- Name: gas_estimation_results gas_estimation_results_unique_chain_and_scenario; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gas_estimation_results
    ADD CONSTRAINT gas_estimation_results_unique_chain_and_scenario UNIQUE (chain_id, scenario);


--
-- Name: gas_prices gas_prices_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gas_prices
    ADD CONSTRAINT gas_prices_chain_id_key UNIQUE (chain_id);


--
-- Name: gas_prices gas_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gas_prices
    ADD CONSTRAINT gas_prices_pkey PRIMARY KEY (id);


--
-- Name: job_tickets job_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_tickets
    ADD CONSTRAINT job_tickets_pkey PRIMARY KEY (id);


--
-- Name: latest_event_block latest_event_block_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.latest_event_block
    ADD CONSTRAINT latest_event_block_pkey PRIMARY KEY (id);


--
-- Name: notification_types notification_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_types
    ADD CONSTRAINT notification_types_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: prepaid_card_color_schemes prepaid_card_color_schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prepaid_card_color_schemes
    ADD CONSTRAINT prepaid_card_color_schemes_pkey PRIMARY KEY (id);


--
-- Name: prepaid_card_customizations prepaid_card_customizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prepaid_card_customizations
    ADD CONSTRAINT prepaid_card_customizations_pkey PRIMARY KEY (id);


--
-- Name: prepaid_card_patterns prepaid_card_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prepaid_card_patterns
    ADD CONSTRAINT prepaid_card_patterns_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_notification_registrations push_notification_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_notification_registrations
    ADD CONSTRAINT push_notification_registrations_pkey PRIMARY KEY (id);


--
-- Name: realm_metas realm_metas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.realm_metas
    ADD CONSTRAINT realm_metas_pkey PRIMARY KEY (realm);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: reward_proofs reward_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_proofs
    ADD CONSTRAINT reward_proofs_pkey PRIMARY KEY (leaf);


--
-- Name: reward_root_index reward_root_index_unique_reward_program_id_and_payment_cycle; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_root_index
    ADD CONSTRAINT reward_root_index_unique_reward_program_id_and_payment_cycle UNIQUE (reward_program_id, payment_cycle);


--
-- Name: scheduled_payment_attempts scheduled_payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_payment_attempts
    ADD CONSTRAINT scheduled_payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: scheduled_payments scheduled_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_pkey PRIMARY KEY (id);


--
-- Name: scheduled_payments scheduled_payments_sp_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_payments
    ADD CONSTRAINT scheduled_payments_sp_hash_key UNIQUE (sp_hash);


--
-- Name: sent_push_notifications sent_push_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sent_push_notifications
    ADD CONSTRAINT sent_push_notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- Name: wallet_orders wallet_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_orders
    ADD CONSTRAINT wallet_orders_pkey PRIMARY KEY (order_id);


--
-- Name: wyre_prices wyre_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wyre_prices
    ADD CONSTRAINT wyre_prices_pkey PRIMARY KEY (sku);


--
-- Name: jobs_priority_run_at_id_locked_at_without_failures_idx; Type: INDEX; Schema: graphile_worker; Owner: postgres
--

CREATE INDEX jobs_priority_run_at_id_locked_at_without_failures_idx ON graphile_worker.jobs USING btree (priority, run_at, id, locked_at) WHERE (attempts < max_attempts);


--
-- Name: discord_bots_bot_type_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX discord_bots_bot_type_status_index ON public.discord_bots USING btree (bot_type, status);


--
-- Name: job_tickets_job_type_owner_address_state_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_tickets_job_type_owner_address_state_index ON public.job_tickets USING btree (job_type, owner_address, state);


--
-- Name: notification_preferences_owner_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_preferences_owner_address_index ON public.notification_preferences USING btree (owner_address);


--
-- Name: notification_preferences_owner_address_notification_type_id_pus; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_preferences_owner_address_notification_type_id_pus ON public.notification_preferences USING btree (owner_address, notification_type_id, push_client_id);


--
-- Name: profiles_slug_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_slug_unique_index ON public.profiles USING btree (slug);


--
-- Name: push_notification_registrations_owner_address_push_client_id_un; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX push_notification_registrations_owner_address_push_client_id_un ON public.push_notification_registrations USING btree (owner_address, push_client_id);


--
-- Name: reservations_id_user_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservations_id_user_address_index ON public.reservations USING btree (id, user_address);


--
-- Name: reservations_updated_at_prepaid_card_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservations_updated_at_prepaid_card_address_index ON public.reservations USING btree (updated_at, prepaid_card_address);


--
-- Name: reservations_updated_at_prepaid_card_address_sku_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservations_updated_at_prepaid_card_address_sku_index ON public.reservations USING btree (updated_at, prepaid_card_address, sku);


--
-- Name: reservations_user_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservations_user_address_index ON public.reservations USING btree (user_address);


--
-- Name: reward_proofs_payee_reward_program_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_proofs_payee_reward_program_id_index ON public.reward_proofs USING btree (payee, reward_program_id);


--
-- Name: scheduled_payment_attempts_scheduled_payment_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payment_attempts_scheduled_payment_id_index ON public.scheduled_payment_attempts USING btree (scheduled_payment_id);


--
-- Name: scheduled_payments_canceled_at_pay_at_creation_block_number_ind; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payments_canceled_at_pay_at_creation_block_number_ind ON public.scheduled_payments USING btree (canceled_at, pay_at, creation_block_number);


--
-- Name: scheduled_payments_recurring_day_of_month_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payments_recurring_day_of_month_index ON public.scheduled_payments USING btree (recurring_day_of_month);


--
-- Name: scheduled_payments_recurring_until_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payments_recurring_until_index ON public.scheduled_payments USING btree (recurring_until);


--
-- Name: scheduled_payments_sender_safe_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payments_sender_safe_address_index ON public.scheduled_payments USING btree (sender_safe_address);


--
-- Name: scheduled_payments_user_address_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scheduled_payments_user_address_index ON public.scheduled_payments USING btree (user_address);


--
-- Name: sent_push_notifications_created_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sent_push_notifications_created_at_index ON public.sent_push_notifications USING btree (created_at);


--
-- Name: wallet_orders_custodial_transfer_id_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wallet_orders_custodial_transfer_id_status_index ON public.wallet_orders USING btree (custodial_transfer_id, status);


--
-- Name: wallet_orders_reservation_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wallet_orders_reservation_id_index ON public.wallet_orders USING btree (reservation_id);


--
-- Name: wyre_prices_disabled_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wyre_prices_disabled_index ON public.wyre_prices USING btree (disabled);


--
-- Name: jobs _100_timestamps; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _100_timestamps BEFORE UPDATE ON graphile_worker.jobs FOR EACH ROW EXECUTE FUNCTION graphile_worker.tg__update_timestamp();


--
-- Name: jobs _500_decrease_job_queue_count; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _500_decrease_job_queue_count AFTER DELETE ON graphile_worker.jobs FOR EACH ROW WHEN ((old.queue_name IS NOT NULL)) EXECUTE FUNCTION graphile_worker.jobs__decrease_job_queue_count();


--
-- Name: jobs _500_decrease_job_queue_count_update; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _500_decrease_job_queue_count_update AFTER UPDATE OF queue_name ON graphile_worker.jobs FOR EACH ROW WHEN (((new.queue_name IS DISTINCT FROM old.queue_name) AND (old.queue_name IS NOT NULL))) EXECUTE FUNCTION graphile_worker.jobs__decrease_job_queue_count();


--
-- Name: jobs _500_increase_job_queue_count; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _500_increase_job_queue_count AFTER INSERT ON graphile_worker.jobs FOR EACH ROW WHEN ((new.queue_name IS NOT NULL)) EXECUTE FUNCTION graphile_worker.jobs__increase_job_queue_count();


--
-- Name: jobs _500_increase_job_queue_count_update; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _500_increase_job_queue_count_update AFTER UPDATE OF queue_name ON graphile_worker.jobs FOR EACH ROW WHEN (((new.queue_name IS DISTINCT FROM old.queue_name) AND (new.queue_name IS NOT NULL))) EXECUTE FUNCTION graphile_worker.jobs__increase_job_queue_count();


--
-- Name: jobs _900_notify_worker; Type: TRIGGER; Schema: graphile_worker; Owner: postgres
--

CREATE TRIGGER _900_notify_worker AFTER INSERT ON graphile_worker.jobs FOR EACH STATEMENT EXECUTE FUNCTION graphile_worker.tg_jobs__notify_new_jobs();


--
-- Name: discord_bots discord_bots_updated_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER discord_bots_updated_trigger AFTER INSERT OR UPDATE ON public.discord_bots FOR EACH ROW EXECUTE FUNCTION public.discord_bots_updated_trigger();


--
-- Name: wallet_orders fk_reservation_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_orders
    ADD CONSTRAINT fk_reservation_id FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: notification_preferences notification_preferences_notification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_notification_type_id_fkey FOREIGN KEY (notification_type_id) REFERENCES public.notification_types(id);


--
-- Name: prepaid_card_customizations prepaid_card_customizations_color_scheme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prepaid_card_customizations
    ADD CONSTRAINT prepaid_card_customizations_color_scheme_id_fkey FOREIGN KEY (color_scheme_id) REFERENCES public.prepaid_card_color_schemes(id);


--
-- Name: prepaid_card_customizations prepaid_card_customizations_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prepaid_card_customizations
    ADD CONSTRAINT prepaid_card_customizations_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES public.prepaid_card_patterns(id);


--
-- Name: scheduled_payment_attempts scheduled_payment_attempts_scheduled_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_payment_attempts
    ADD CONSTRAINT scheduled_payment_attempts_scheduled_payment_id_fkey FOREIGN KEY (scheduled_payment_id) REFERENCES public.scheduled_payments(id);


--
-- Name: job_queues; Type: ROW SECURITY; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE graphile_worker.job_queues ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE graphile_worker.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: known_crontabs; Type: ROW SECURITY; Schema: graphile_worker; Owner: postgres
--

ALTER TABLE graphile_worker.known_crontabs ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.1
-- Dumped by pg_dump version 15.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: graphile_worker; Owner: postgres
--

COPY graphile_worker.migrations (id, ts) FROM stdin;
1	2023-01-31 06:35:51.887577+00
2	2023-01-31 06:35:51.887577+00
3	2023-01-31 06:35:51.887577+00
4	2023-01-31 06:35:51.887577+00
5	2023-01-31 06:35:51.887577+00
6	2023-01-31 06:35:51.887577+00
7	2023-01-31 06:35:51.887577+00
8	2023-01-31 06:35:51.887577+00
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	20210527151505645_create-prepaid-card-tables	2023-01-31 06:35:51.737649
2	20210614080132698_create-prepaid-card-customizations-table	2023-01-31 06:35:51.819927
3	20210623052200757_create-graphile-worker-schema	2023-01-31 06:35:51.887577
4	20210809113449561_merchant-infos	2023-01-31 06:35:52.266943
5	20210817184105100_wallet-orders	2023-01-31 06:35:52.318655
6	20210920142313915_prepaid-card-reservations	2023-01-31 06:35:52.391978
7	20210924200122612_order-indicies	2023-01-31 06:35:52.491025
8	20211006090701108_create-card-spaces	2023-01-31 06:35:52.520617
9	20211013155536724_card-index	2023-01-31 06:35:52.571556
10	20211013173917696_beta-testers	2023-01-31 06:35:52.611878
11	20211014131843187_add-fields-to-card-spaces	2023-01-31 06:35:52.68478
12	20211020231214235_discord-bots	2023-01-31 06:35:52.694597
13	20211105180905492_wyre-price-service	2023-01-31 06:35:52.763498
14	20211110210324178_card-index-part-duex	2023-01-31 06:35:52.815092
15	20211118084217151_create-uploads	2023-01-31 06:35:52.82064
16	20211129083801382_create-push-notification-registrations	2023-01-31 06:35:52.859542
17	20211129123635817_create-notification-types	2023-01-31 06:35:52.907068
18	20211129130425303_create-notification-preferences	2023-01-31 06:35:52.947161
19	20211206195559187_card-index-generations	2023-01-31 06:35:53.023658
20	20211207151150639_sent-push-notifications	2023-01-31 06:35:53.037109
21	20211207190527999_create-latest-event-block	2023-01-31 06:35:53.090229
22	20211214163123421_card-index-errors	2023-01-31 06:35:53.120712
23	20220103201128435_invalidation-ordering	2023-01-31 06:35:53.169331
24	20220107151914576_rename-beta-testers-table	2023-01-31 06:35:53.243516
25	20220111204952452_index-optimizations	2023-01-31 06:35:53.25343
26	20220119232151260_space-belongs-to-merchant	2023-01-31 06:35:53.259283
27	20220216104259120_allow-nulls-in-card-spaces	2023-01-31 06:35:53.289632
28	20220301101637933_create-card-space-profiles-for-existing-merchants	2023-01-31 06:35:53.315374
29	20220413090421591_card-space-unused-data-cleanup	2023-01-31 06:35:53.320606
30	20220413215720902_create-email-card-drop-requests	2023-01-31 06:35:53.332516
31	20220502174343477_create-email-card-drop-state	2023-01-31 06:35:53.38948
32	20220527204632100_create-exchange-rates	2023-01-31 06:35:53.415595
33	20220610203119883_create-job-tickets	2023-01-31 06:35:53.456398
34	20220622235635327_add-job-ticket-spec	2023-01-31 06:35:53.505972
35	20220629173134216_add-job-ticket-source-arguments	2023-01-31 06:35:53.510861
36	20220728144935996_add-profiles	2023-01-31 06:35:53.51577
37	20220802184224370_populate-profiles	2023-01-31 06:35:53.56935
38	20220802184244353_delete-profile-components	2023-01-31 06:35:53.635183
39	20220810123016866_create-scheduled-payments	2023-01-31 06:35:53.641356
40	20220810123029047_create-scheduled-payment-attempts	2023-01-31 06:35:53.707003
41	20220831081406596_alter-scheduled-payment-fields	2023-01-31 06:35:53.762472
42	20220921073021534_alter-scheduled-payment-fields-2	2023-01-31 06:35:53.811523
43	20221003121041200_change_bigint-add-gas-token-address-to-scheduled-payments	2023-01-31 06:35:54.106182
44	20221014121655874_rename-cancellation-transaction-error	2023-01-31 06:35:54.782145
45	20221025140643069_create-crank-nonces	2023-01-31 06:35:54.789055
46	20221115065506357_create-gas-prices	2023-01-31 06:35:54.831872
47	20221121080727272_create-gas-estimation-results	2023-01-31 06:35:54.883421
48	20221215102320386_reward-root-index	2023-01-31 06:35:54.933353
49	20221215134519797_reward-proofs	2023-01-31 06:35:54.971377
50	20230104034916208_add-block-number-to-reward-root-index	2023-01-31 06:35:55.020757
51	20230131060836816_alter-gas-estimation-results-fields	2023-01-31 06:35:55.026768
\.


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 51, true);


--
-- PostgreSQL database dump complete
--

