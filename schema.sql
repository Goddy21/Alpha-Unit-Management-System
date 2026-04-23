--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_events_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_events_updated_at() OWNER TO postgres;

--
-- Name: update_patrol_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_patrol_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_patrol_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: camera_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.camera_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    camera_id uuid,
    event_type character varying(50),
    "timestamp" timestamp without time zone NOT NULL,
    description text,
    snapshot_url character varying(500),
    video_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.camera_events OWNER TO postgres;

--
-- Name: cameras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cameras (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    camera_code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    site_id uuid,
    location character varying(255),
    status character varying(20) DEFAULT 'online'::character varying,
    recording_enabled boolean DEFAULT true,
    stream_url character varying(500),
    last_activity timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cameras_status_check CHECK (((status)::text = ANY ((ARRAY['online'::character varying, 'offline'::character varying, 'motion-detected'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.cameras OWNER TO postgres;

--
-- Name: certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    personnel_id uuid,
    name character varying(255) NOT NULL,
    issue_date date,
    expiry_date date,
    status character varying(20) DEFAULT 'valid'::character varying,
    file_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certifications_status_check CHECK (((status)::text = ANY ((ARRAY['valid'::character varying, 'expiring'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.certifications OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(100),
    contact_person character varying(255),
    email character varying(255),
    phone character varying(20),
    address text,
    total_guards integer DEFAULT 0,
    monthly_value numeric(12,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contract_code character varying(20) NOT NULL,
    client_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    value numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    billing_cycle character varying(20),
    sla_response character varying(50),
    auto_renew boolean DEFAULT false,
    terms_conditions text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contracts_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'annually'::character varying])::text[]))),
    CONSTRAINT contracts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'expired'::character varying, 'terminated'::character varying])::text[])))
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: drones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    drone_code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    model character varying(100),
    serial_number character varying(100),
    status character varying(20) DEFAULT 'available'::character varying,
    battery_level integer DEFAULT 100,
    flight_hours numeric(10,2) DEFAULT 0,
    last_maintenance date,
    next_maintenance date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    features jsonb DEFAULT '[]'::jsonb,
    notes text,
    CONSTRAINT drones_status_check CHECK (((status)::text = ANY (ARRAY['available'::text, 'in-flight'::text, 'maintenance'::text, 'charging'::text, 'retired'::text])))
);


ALTER TABLE public.drones OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    event_type character varying(50) DEFAULT 'general'::character varying NOT NULL,
    status character varying(30) DEFAULT 'planned'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    venue_name character varying(255),
    address text,
    coordinates character varying(100),
    site_id uuid,
    client_id uuid,
    expected_attendance bigint DEFAULT 0,
    actual_attendance bigint DEFAULT 0,
    max_capacity bigint DEFAULT 0,
    ambulances_deployed integer DEFAULT 0,
    ambulances_required integer DEFAULT 0,
    fire_engines_deployed integer DEFAULT 0,
    fire_engines_required integer DEFAULT 0,
    police_officers integer DEFAULT 0,
    police_units integer DEFAULT 0,
    security_guards integer DEFAULT 0,
    supervisors integer DEFAULT 0,
    vehicles_deployed integer DEFAULT 0,
    communication_devices integer DEFAULT 0,
    first_aid_stations integer DEFAULT 0,
    evacuation_routes text,
    briefing_notes text,
    logistics_notes text,
    images jsonb DEFAULT '[]'::jsonb,
    videos jsonb DEFAULT '[]'::jsonb,
    equipment_list jsonb DEFAULT '[]'::jsonb,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    risk_notes text,
    permits_required boolean DEFAULT false,
    permits_obtained boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: flight_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flight_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    flight_code character varying(20) NOT NULL,
    drone_id uuid,
    pilot_id uuid,
    site_id uuid,
    mission_name character varying(255),
    flight_date date,
    takeoff_time time without time zone,
    landing_time time without time zone,
    duration integer,
    status character varying(20),
    purpose text,
    altitude numeric(10,2),
    distance numeric(10,2),
    battery_used integer,
    video_footage boolean DEFAULT false,
    photo_count integer DEFAULT 0,
    incident_linked uuid,
    weather_conditions text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    weather character varying(100),
    CONSTRAINT flight_logs_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in-flight'::character varying, 'completed'::character varying, 'aborted'::character varying, 'reviewing'::character varying])::text[])))
);


ALTER TABLE public.flight_logs OWNER TO postgres;

--
-- Name: incident_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incident_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    incident_id uuid,
    file_name character varying(255),
    file_url character varying(500),
    file_type character varying(50),
    file_size integer,
    uploaded_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.incident_attachments OWNER TO postgres;

--
-- Name: incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    incident_code character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    site_id uuid,
    reported_by uuid,
    "timestamp" timestamp without time zone NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    category character varying(100),
    location character varying(255),
    gps_latitude numeric(10,8),
    gps_longitude numeric(11,8),
    assigned_to character varying(255),
    resolved_at timestamp without time zone,
    response_time integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gps_coords character varying(100),
    attachment_count integer DEFAULT 0,
    notes text,
    CONSTRAINT incidents_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT incidents_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.incidents OWNER TO postgres;

--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(50),
    serial_number character varying(100),
    quantity integer,
    status character varying(20) DEFAULT 'available'::character varying,
    condition character varying(20),
    assigned_to uuid,
    location character varying(255),
    purchase_date date,
    purchase_price numeric(12,2),
    current_value numeric(12,2),
    last_maintenance date,
    next_maintenance date,
    warranty_expiry date,
    supplier character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_category_check CHECK (((category)::text = ANY ((ARRAY['Uniform'::character varying, 'Equipment'::character varying, 'Vehicle'::character varying, 'Firearm'::character varying, 'Communication'::character varying, 'Technology'::character varying])::text[]))),
    CONSTRAINT inventory_condition_check CHECK (((condition)::text = ANY ((ARRAY['new'::character varying, 'good'::character varying, 'fair'::character varying, 'poor'::character varying])::text[]))),
    CONSTRAINT inventory_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'assigned'::character varying, 'maintenance'::character varying, 'retired'::character varying])::text[])))
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid,
    description character varying(255),
    quantity integer DEFAULT 1,
    unit_price numeric(12,2),
    total_price numeric(12,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_code character varying(20) NOT NULL,
    client_id uuid,
    amount numeric(12,2) NOT NULL,
    due_date date,
    status character varying(20) DEFAULT 'pending'::character varying,
    period_start date,
    period_end date,
    billing_period character varying(100),
    payment_date date,
    payment_method character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY (ARRAY['draft'::text, 'pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])))
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type character varying(50) NOT NULL,
    year integer NOT NULL,
    allocated integer DEFAULT 0 NOT NULL,
    used integer DEFAULT 0 NOT NULL,
    pending integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.leave_balances OWNER TO postgres;

--
-- Name: leave_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leave_comments OWNER TO postgres;

--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    attachment_url text,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    first_approver_id uuid,
    first_approved_at timestamp with time zone,
    first_comment text,
    final_approver_id uuid,
    final_approved_at timestamp with time zone,
    final_comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_leave_type_check CHECK (((leave_type)::text = ANY ((ARRAY['annual'::character varying, 'sick'::character varying, 'maternity'::character varying, 'paternity'::character varying, 'compassionate'::character varying, 'study'::character varying, 'unpaid'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'first_approved'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    notification_code character varying(20) DEFAULT ('NTF'::text || lpad((floor((random() * (1000000)::double precision)))::text, 6, '0'::text)) NOT NULL,
    type character varying(50),
    title character varying(255) NOT NULL,
    message text,
    priority character varying(20),
    category character varying(100),
    action_required boolean DEFAULT false,
    link character varying(500),
    recipient_type character varying(50),
    read_by jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read boolean DEFAULT false,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT notifications_recipient_type_check CHECK (((recipient_type)::text = ANY ((ARRAY['all'::character varying, 'admins'::character varying, 'operations'::character varying, 'guards'::character varying, 'clients'::character varying])::text[]))),
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['incident'::character varying, 'system'::character varying, 'personnel'::character varying, 'client'::character varying, 'maintenance'::character varying, 'alert'::character varying])::text[])))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: patrol_checkpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patrol_checkpoints (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    route_id uuid,
    checkpoint_name character varying(255),
    expected_time time without time zone,
    actual_time timestamp without time zone,
    gps_latitude numeric(10,8),
    gps_longitude numeric(11,8),
    status character varying(20),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patrol_checkpoints_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'missed'::character varying])::text[])))
);


ALTER TABLE public.patrol_checkpoints OWNER TO postgres;

--
-- Name: patrol_routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patrol_routes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    route_code character varying(20) NOT NULL,
    personnel_id uuid,
    site_id uuid,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    checkpoints_total integer DEFAULT 0,
    checkpoints_completed integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    distance numeric(10,2),
    duration integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patrol_routes_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'deviation'::character varying, 'delayed'::character varying])::text[])))
);


ALTER TABLE public.patrol_routes OWNER TO postgres;

--
-- Name: personnel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personnel (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    guard_code character varying(20) NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    employee_id character varying(50) NOT NULL,
    phone character varying(20),
    email character varying(255),
    psra_license character varying(50),
    psra_expiry date,
    status character varying(20) DEFAULT 'active'::character varying,
    current_site_id uuid,
    join_date date,
    training_hours integer DEFAULT 0,
    rating numeric(2,1) DEFAULT 0.0,
    shifts_completed integer DEFAULT 0,
    incidents_reported integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT personnel_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'on-leave'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))
);


ALTER TABLE public.personnel OWNER TO postgres;

--
-- Name: portal_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portal_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    client_id uuid,
    role character varying(50),
    access_level character varying(50),
    view_incidents boolean DEFAULT false,
    view_cctv boolean DEFAULT false,
    view_invoices boolean DEFAULT false,
    view_reports boolean DEFAULT false,
    submit_requests boolean DEFAULT false,
    view_personnel boolean DEFAULT false,
    login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'active'::character varying,
    name character varying(255),
    email character varying(255),
    two_factor_enabled boolean DEFAULT false,
    permissions jsonb DEFAULT '{}'::jsonb,
    last_login timestamp without time zone,
    CONSTRAINT portal_users_access_level_check CHECK (((access_level)::text = ANY ((ARRAY['full'::character varying, 'limited'::character varying, 'read-only'::character varying])::text[]))),
    CONSTRAINT portal_users_role_check CHECK (((role)::text = ANY ((ARRAY['primary'::character varying, 'secondary'::character varying, 'viewer'::character varying])::text[])))
);


ALTER TABLE public.portal_users OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_agent text,
    ip_address character varying(45),
    last_used_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_code character varying(20) NOT NULL,
    client_id uuid,
    type character varying(50),
    subject character varying(255) NOT NULL,
    description text,
    priority character varying(20),
    status character varying(20) DEFAULT 'open'::character varying,
    submitted_by uuid,
    assigned_to uuid,
    submitted_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_date timestamp without time zone,
    response_time integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT service_requests_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in-progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT service_requests_type_check CHECK (((type)::text = ANY ((ARRAY['incident'::character varying, 'complaint'::character varying, 'additional-service'::character varying, 'maintenance'::character varying, 'general'::character varying])::text[])))
);


ALTER TABLE public.service_requests OWNER TO postgres;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    shift_code character varying(20) NOT NULL,
    personnel_id uuid,
    site_id uuid,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    check_in_time timestamp without time zone,
    check_out_time timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shifts_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'ongoing'::character varying, 'completed'::character varying, 'missed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    site_code character varying(20) NOT NULL,
    client_id uuid,
    name character varying(255) NOT NULL,
    address text,
    guards_required integer DEFAULT 0,
    gps_latitude numeric(10,8),
    gps_longitude numeric(11,8),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    county character varying(100),
    contact_person character varying(255),
    contact_phone character varying(20),
    risk_level character varying(20) DEFAULT 'medium'::character varying,
    notes text,
    CONSTRAINT sites_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT sites_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.sites OWNER TO postgres;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key character varying(255) NOT NULL,
    value text DEFAULT '{}'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    permission_name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    phone character varying(20),
    role character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    department character varying(100),
    last_active timestamp without time zone,
    email_verified boolean DEFAULT false,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret character varying(255),
    password_reset_token character varying(255),
    password_reset_expires timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['Admin'::character varying, 'Managing Director'::character varying, 'Director Logistics'::character varying, 'HR Manager'::character varying, 'Finance Manager'::character varying, 'Operations Manager'::character varying, 'Supervisor'::character varying, 'Guard'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: camera_events camera_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_events
    ADD CONSTRAINT camera_events_pkey PRIMARY KEY (id);


--
-- Name: cameras cameras_camera_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_camera_code_key UNIQUE (camera_code);


--
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (id);


--
-- Name: certifications certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certifications
    ADD CONSTRAINT certifications_pkey PRIMARY KEY (id);


--
-- Name: clients clients_client_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_code_key UNIQUE (client_code);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_code_key UNIQUE (contract_code);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: drones drones_drone_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drones
    ADD CONSTRAINT drones_drone_code_key UNIQUE (drone_code);


--
-- Name: drones drones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drones
    ADD CONSTRAINT drones_pkey PRIMARY KEY (id);


--
-- Name: drones drones_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drones
    ADD CONSTRAINT drones_serial_number_key UNIQUE (serial_number);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: flight_logs flight_logs_flight_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_flight_code_key UNIQUE (flight_code);


--
-- Name: flight_logs flight_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_pkey PRIMARY KEY (id);


--
-- Name: incident_attachments incident_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_attachments
    ADD CONSTRAINT incident_attachments_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_incident_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_incident_code_key UNIQUE (incident_code);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_inventory_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_inventory_code_key UNIQUE (inventory_code);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_code_key UNIQUE (invoice_code);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_user_id_leave_type_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_leave_type_year_key UNIQUE (user_id, leave_type, year);


--
-- Name: leave_comments leave_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_comments
    ADD CONSTRAINT leave_comments_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_notification_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_notification_code_key UNIQUE (notification_code);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: patrol_checkpoints patrol_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_checkpoints
    ADD CONSTRAINT patrol_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: patrol_routes patrol_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_routes
    ADD CONSTRAINT patrol_routes_pkey PRIMARY KEY (id);


--
-- Name: patrol_routes patrol_routes_route_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_routes
    ADD CONSTRAINT patrol_routes_route_code_key UNIQUE (route_code);


--
-- Name: personnel personnel_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_employee_id_key UNIQUE (employee_id);


--
-- Name: personnel personnel_guard_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_guard_code_key UNIQUE (guard_code);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: portal_users portal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_users
    ADD CONSTRAINT portal_users_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_request_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_request_code_key UNIQUE (request_code);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_shift_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_shift_code_key UNIQUE (shift_code);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sites sites_site_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_site_code_key UNIQUE (site_code);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_clients_client_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_client_code ON public.clients USING btree (client_code);


--
-- Name: idx_events_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_client_id ON public.events USING btree (client_id);


--
-- Name: idx_events_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_event_type ON public.events USING btree (event_type);


--
-- Name: idx_events_site_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_site_id ON public.events USING btree (site_id);


--
-- Name: idx_events_start_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_events_status ON public.events USING btree (status);


--
-- Name: idx_incidents_incident_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_incident_code ON public.incidents USING btree (incident_code);


--
-- Name: idx_incidents_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_severity ON public.incidents USING btree (severity);


--
-- Name: idx_incidents_site_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_site_id ON public.incidents USING btree (site_id);


--
-- Name: idx_incidents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_status ON public.incidents USING btree (status);


--
-- Name: idx_incidents_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_timestamp ON public.incidents USING btree ("timestamp" DESC);


--
-- Name: idx_invoices_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_client_id ON public.invoices USING btree (client_id);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_leave_comments_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_comments_request_id ON public.leave_comments USING btree (leave_request_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_type);


--
-- Name: idx_notifications_recipient_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_recipient_type ON public.notifications USING btree (recipient_type);


--
-- Name: idx_notifications_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_timestamp ON public.notifications USING btree ("timestamp" DESC);


--
-- Name: idx_patrol_routes_site_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patrol_routes_site_id ON public.patrol_routes USING btree (site_id);


--
-- Name: idx_patrol_routes_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patrol_routes_start_time ON public.patrol_routes USING btree (start_time DESC);


--
-- Name: idx_patrol_routes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patrol_routes_status ON public.patrol_routes USING btree (status);


--
-- Name: idx_personnel_current_site; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_current_site ON public.personnel USING btree (current_site_id);


--
-- Name: idx_personnel_guard_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_guard_code ON public.personnel USING btree (guard_code);


--
-- Name: idx_personnel_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personnel_status ON public.personnel USING btree (status);


--
-- Name: idx_shifts_personnel_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shifts_personnel_id ON public.shifts USING btree (personnel_id);


--
-- Name: idx_shifts_shift_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shifts_shift_date ON public.shifts USING btree (shift_date);


--
-- Name: idx_shifts_site_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shifts_site_id ON public.shifts USING btree (site_id);


--
-- Name: idx_shifts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shifts_status ON public.shifts USING btree (status);


--
-- Name: idx_sites_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sites_client_id ON public.sites USING btree (client_id);


--
-- Name: idx_sites_site_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sites_site_code ON public.sites USING btree (site_code);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: leave_requests set_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patrol_routes trg_patrol_routes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_patrol_routes_updated_at BEFORE UPDATE ON public.patrol_routes FOR EACH ROW EXECUTE FUNCTION public.update_patrol_updated_at();


--
-- Name: events trigger_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_events_updated_at();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: incidents update_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: personnel update_personnel_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shifts update_shifts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sites update_sites_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: camera_events camera_events_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_events
    ADD CONSTRAINT camera_events_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- Name: cameras cameras_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: certifications certifications_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certifications
    ADD CONSTRAINT certifications_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: events events_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: flight_logs flight_logs_drone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_drone_id_fkey FOREIGN KEY (drone_id) REFERENCES public.drones(id) ON DELETE CASCADE;


--
-- Name: flight_logs flight_logs_incident_linked_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_incident_linked_fkey FOREIGN KEY (incident_linked) REFERENCES public.incidents(id);


--
-- Name: flight_logs flight_logs_pilot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_pilot_id_fkey FOREIGN KEY (pilot_id) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: flight_logs flight_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_logs
    ADD CONSTRAINT flight_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: incident_attachments incident_attachments_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_attachments
    ADD CONSTRAINT incident_attachments_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- Name: incident_attachments incident_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incident_attachments
    ADD CONSTRAINT incident_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: incidents incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: incidents incidents_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: inventory inventory_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.personnel(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leave_comments leave_comments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_comments
    ADD CONSTRAINT leave_comments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_comments leave_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_comments
    ADD CONSTRAINT leave_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_final_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_final_approver_id_fkey FOREIGN KEY (final_approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_first_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_first_approver_id_fkey FOREIGN KEY (first_approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patrol_checkpoints patrol_checkpoints_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_checkpoints
    ADD CONSTRAINT patrol_checkpoints_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.patrol_routes(id) ON DELETE CASCADE;


--
-- Name: patrol_routes patrol_routes_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_routes
    ADD CONSTRAINT patrol_routes_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: patrol_routes patrol_routes_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_routes
    ADD CONSTRAINT patrol_routes_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: personnel personnel_current_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_current_site_id_fkey FOREIGN KEY (current_site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: personnel personnel_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: portal_users portal_users_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_users
    ADD CONSTRAINT portal_users_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: portal_users portal_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_users
    ADD CONSTRAINT portal_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: service_requests service_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: shifts shifts_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: sites sites_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

