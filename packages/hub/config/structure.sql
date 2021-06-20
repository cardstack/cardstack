--
-- PostgreSQL database dump
--

-- Dumped from database version 13.3
-- Dumped by pg_dump version 13.3

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


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
-- PostgreSQL database dump complete
--

