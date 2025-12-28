--
-- PostgreSQL database dump
--

\restrict 8gpv4nNpuYBATultC26DRGqc88yGkYzc5rg0MtQPcW4OM9bNwkVQpBPRTyjSUU8

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

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
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'Trigram matching for fuzzy text search';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for password hashing and tokens';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';


--
-- Name: badge_type; Type: TYPE; Schema: public; Owner: reading_buddy
--

CREATE TYPE public.badge_type AS ENUM (
    'checkpoint',
    'quiz_mastery',
    'book_completion',
    'streak',
    'custom'
);


ALTER TYPE public.badge_type OWNER TO reading_buddy;

--
-- Name: book_access_level; Type: TYPE; Schema: public; Owner: reading_buddy
--

CREATE TYPE public.book_access_level AS ENUM (
    'KINDERGARTEN',
    'LOWER_ELEMENTARY',
    'UPPER_ELEMENTARY',
    'JUNIOR_HIGH',
    'TEACHERS_STAFF'
);


ALTER TYPE public.book_access_level OWNER TO reading_buddy;

--
-- Name: quiz_type; Type: TYPE; Schema: public; Owner: reading_buddy
--

CREATE TYPE public.quiz_type AS ENUM (
    'checkpoint',
    'classroom'
);


ALTER TYPE public.quiz_type OWNER TO reading_buddy;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: reading_buddy
--

CREATE TYPE public.user_role AS ENUM (
    'STUDENT',
    'TEACHER',
    'LIBRARIAN',
    'ADMIN'
);


ALTER TYPE public.user_role OWNER TO reading_buddy;

--
-- Name: award_xp(uuid, integer, character varying, text, text); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.award_xp(p_student_id uuid, p_amount integer, p_source character varying, p_source_id text DEFAULT NULL::text, p_description text DEFAULT NULL::text) RETURNS TABLE(new_xp integer, new_level integer, level_up boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_leveled_up BOOLEAN;
BEGIN
  -- Get current XP and level
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM profiles
  WHERE id = p_student_id;

  -- Calculate new XP and level
  v_new_xp := v_current_xp + p_amount;
  v_new_level := calculate_level(v_new_xp);
  v_leveled_up := v_new_level > v_current_level;

  -- Update profile
  UPDATE profiles
  SET xp = v_new_xp,
      level = v_new_level,
      updated_at = NOW()
  WHERE id = p_student_id;

  -- Record transaction
  INSERT INTO xp_transactions (student_id, amount, source, source_id, description)
  VALUES (p_student_id, p_amount, p_source, p_source_id, p_description);

  -- Return results
  RETURN QUERY SELECT v_new_xp, v_new_level, v_leveled_up;
END;
$$;


ALTER FUNCTION public.award_xp(p_student_id uuid, p_amount integer, p_source character varying, p_source_id text, p_description text) OWNER TO reading_buddy;

--
-- Name: FUNCTION award_xp(p_student_id uuid, p_amount integer, p_source character varying, p_source_id text, p_description text); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.award_xp(p_student_id uuid, p_amount integer, p_source character varying, p_source_id text, p_description text) IS 'Award XP to student and update level';


--
-- Name: calculate_level(integer); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.calculate_level(xp_amount integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Formula: level = floor(sqrt(xp / 50)) + 1, capped at 100
  RETURN LEAST(FLOOR(SQRT(xp_amount::FLOAT / 50)) + 1, 100);
END;
$$;


ALTER FUNCTION public.calculate_level(xp_amount integer) OWNER TO reading_buddy;

--
-- Name: FUNCTION calculate_level(xp_amount integer); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.calculate_level(xp_amount integer) IS 'Calculate user level from XP amount';


--
-- Name: check_book_specific_badge(uuid, integer); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.check_book_specific_badge(p_student_id uuid, p_book_id integer) RETURNS TABLE(badge_id uuid, badge_name character varying, already_earned boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS badge_id,
    b.name AS badge_name,
    EXISTS(
      SELECT 1 FROM student_badges sb
      WHERE sb.student_id = p_student_id
        AND sb.badge_id = b.id
        AND sb.book_id = p_book_id
    ) AS already_earned
  FROM badges b
  WHERE b.book_id = p_book_id
    AND b.is_active = TRUE;
END;
$$;


ALTER FUNCTION public.check_book_specific_badge(p_student_id uuid, p_book_id integer) OWNER TO reading_buddy;

--
-- Name: FUNCTION check_book_specific_badge(p_student_id uuid, p_book_id integer); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.check_book_specific_badge(p_student_id uuid, p_book_id integer) IS 'Check if student has earned book-specific badges';


--
-- Name: create_or_update_profile(uuid, text, text, public.user_role); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.create_or_update_profile(p_user_id uuid, p_email text, p_full_name text DEFAULT NULL::text, p_role public.user_role DEFAULT 'STUDENT'::public.user_role) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Check if profile exists
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    -- Create new profile with specified role
    INSERT INTO profiles (
      user_id,
      email,
      full_name,
      role,
      access_level,
      xp,
      level,
      reading_streak,
      longest_streak
    ) VALUES (
      p_user_id,
      p_email,
      p_full_name,
      p_role,
      'LOWER_ELEMENTARY',
      0,
      1,
      0,
      0
    )
    RETURNING id INTO v_profile_id;
  ELSE
    -- Update existing profile (preserve existing role)
    UPDATE profiles
    SET email = p_email,
        full_name = COALESCE(p_full_name, full_name),
        updated_at = NOW()
    WHERE id = v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;


ALTER FUNCTION public.create_or_update_profile(p_user_id uuid, p_email text, p_full_name text, p_role public.user_role) OWNER TO reading_buddy;

--
-- Name: FUNCTION create_or_update_profile(p_user_id uuid, p_email text, p_full_name text, p_role public.user_role); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.create_or_update_profile(p_user_id uuid, p_email text, p_full_name text, p_role public.user_role) IS 'Create or update user profile from NextAuth';


--
-- Name: get_all_user_emails(); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.get_all_user_emails() RETURNS TABLE(user_id uuid, email text, role public.user_role)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_requesting_user_role user_role;
BEGIN
  -- Get requesting user's role
  SELECT p.role INTO v_requesting_user_role
  FROM profiles p
  WHERE p.user_id = current_setting('app.user_id', TRUE)::UUID;

  -- Only ADMIN can execute
  IF v_requesting_user_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: only administrators can view user emails';
  END IF;

  -- Return user emails with roles
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email AS email,
    COALESCE(p.role, 'STUDENT'::user_role) AS role
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_all_user_emails() OWNER TO reading_buddy;

--
-- Name: FUNCTION get_all_user_emails(); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.get_all_user_emails() IS 'Get all user emails (ADMIN only)';


--
-- Name: get_current_profile_id(); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.get_current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM profiles
  WHERE user_id = current_setting('app.user_id', TRUE)::UUID
  LIMIT 1;
$$;


ALTER FUNCTION public.get_current_profile_id() OWNER TO reading_buddy;

--
-- Name: FUNCTION get_current_profile_id(); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.get_current_profile_id() IS 'Get current users profile ID from session context';


--
-- Name: get_current_user_role(); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.get_current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE
    AS $$
  SELECT role FROM profiles
  WHERE user_id = current_setting('app.user_id', TRUE)::UUID
  LIMIT 1;
$$;


ALTER FUNCTION public.get_current_user_role() OWNER TO reading_buddy;

--
-- Name: FUNCTION get_current_user_role(); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.get_current_user_role() IS 'Get current users role from session context';


--
-- Name: update_reading_streak(uuid); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.update_reading_streak(p_student_id uuid) RETURNS TABLE(current_streak integer, is_new_streak boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_last_read_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
  v_is_new_streak BOOLEAN := FALSE;
BEGIN
  -- Get current streak data
  SELECT last_read_date, reading_streak, longest_streak
  INTO v_last_read_date, v_current_streak, v_longest_streak
  FROM profiles
  WHERE id = p_student_id;

  -- Calculate new streak
  IF v_last_read_date IS NULL THEN
    -- First time reading
    v_current_streak := 1;
    v_is_new_streak := TRUE;
  ELSIF v_last_read_date = v_today THEN
    -- Already read today, no change
    v_is_new_streak := FALSE;
  ELSIF v_last_read_date = v_today - INTERVAL '1 day' THEN
    -- Read yesterday, continue streak
    v_current_streak := v_current_streak + 1;
    v_is_new_streak := TRUE;
  ELSE
    -- Streak broken, start over
    v_current_streak := 1;
    v_is_new_streak := TRUE;
  END IF;

  -- Update longest streak if necessary
  v_longest_streak := GREATEST(v_longest_streak, v_current_streak);

  -- Update profile
  UPDATE profiles
  SET reading_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_read_date = v_today,
      updated_at = NOW()
  WHERE id = p_student_id;

  -- Return results
  RETURN QUERY SELECT v_current_streak, v_is_new_streak;
END;
$$;


ALTER FUNCTION public.update_reading_streak(p_student_id uuid) OWNER TO reading_buddy;

--
-- Name: FUNCTION update_reading_streak(p_student_id uuid); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.update_reading_streak(p_student_id uuid) IS 'Update daily reading streak for student';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO reading_buddy;

--
-- Name: FUNCTION update_updated_at_column(); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Automatically update updated_at timestamp';


--
-- Name: xp_for_level(integer); Type: FUNCTION; Schema: public; Owner: reading_buddy
--

CREATE FUNCTION public.xp_for_level(level_num integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  -- Inverse of level formula: xp = 50 * (level - 1)^2
  RETURN 50 * POWER(level_num - 1, 2);
END;
$$;


ALTER FUNCTION public.xp_for_level(level_num integer) OWNER TO reading_buddy;

--
-- Name: FUNCTION xp_for_level(level_num integer); Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON FUNCTION public.xp_for_level(level_num integer) IS 'Calculate XP required for specific level';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.accounts OWNER TO reading_buddy;

--
-- Name: TABLE accounts; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.accounts IS 'NextAuth accounts table - stores OAuth and provider linkages';


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.achievements (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    badge_url text NOT NULL,
    criteria jsonb
);


ALTER TABLE public.achievements OWNER TO reading_buddy;

--
-- Name: achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.achievements_id_seq OWNER TO reading_buddy;

--
-- Name: achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.achievements_id_seq OWNED BY public.achievements.id;


--
-- Name: badges; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon_url text,
    badge_type character varying(50) NOT NULL,
    criteria jsonb NOT NULL,
    tier character varying(20) DEFAULT 'bronze'::character varying,
    xp_reward integer DEFAULT 0,
    category character varying(50),
    display_order integer,
    is_active boolean DEFAULT true,
    book_id integer,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT badges_badge_type_check CHECK (((badge_type)::text = ANY ((ARRAY['checkpoint'::character varying, 'quiz_mastery'::character varying, 'book_completion'::character varying, 'streak'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.badges OWNER TO reading_buddy;

--
-- Name: TABLE badges; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.badges IS 'Achievement badges available in the system';


--
-- Name: COLUMN badges.tier; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.badges.tier IS 'Badge tier: bronze, silver, gold, platinum, special';


--
-- Name: COLUMN badges.category; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.badges.category IS 'Badge category for organization: reading, milestone, quiz, streak, special';


--
-- Name: COLUMN badges.display_order; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.badges.display_order IS 'Order to display badges in UI';


--
-- Name: book_access; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.book_access (
    id integer NOT NULL,
    book_id integer NOT NULL,
    access_level public.book_access_level NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.book_access OWNER TO reading_buddy;

--
-- Name: book_access_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.book_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.book_access_id_seq OWNER TO reading_buddy;

--
-- Name: book_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.book_access_id_seq OWNED BY public.book_access.id;


--
-- Name: book_render_jobs; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.book_render_jobs (
    id integer NOT NULL,
    book_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_pages integer,
    processed_pages integer,
    error_message text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.book_render_jobs OWNER TO reading_buddy;

--
-- Name: book_render_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.book_render_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.book_render_jobs_id_seq OWNER TO reading_buddy;

--
-- Name: book_render_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.book_render_jobs_id_seq OWNED BY public.book_render_jobs.id;


--
-- Name: books; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.books (
    id integer NOT NULL,
    title text NOT NULL,
    author text,
    description text,
    category text,
    grade_level integer,
    page_count integer,
    pdf_url text NOT NULL,
    cover_url text NOT NULL,
    isbn text,
    publisher text,
    publication_year integer,
    genre text,
    language text,
    page_images_prefix text,
    page_images_count integer,
    page_images_rendered_at timestamp with time zone,
    file_format character varying(20) DEFAULT 'pdf'::character varying,
    original_file_url text,
    file_size_bytes bigint,
    page_text_content jsonb,
    text_extracted_at timestamp with time zone,
    text_extraction_method character varying(50),
    text_extraction_error text,
    text_extraction_attempts integer DEFAULT 0,
    last_extraction_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.books OWNER TO reading_buddy;

--
-- Name: TABLE books; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.books IS 'Book catalog with multi-format support';


--
-- Name: books_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.books_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.books_id_seq OWNER TO reading_buddy;

--
-- Name: books_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.books_id_seq OWNED BY public.books.id;


--
-- Name: class_books; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.class_books (
    class_id integer NOT NULL,
    book_id integer NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    due_date timestamp with time zone
);


ALTER TABLE public.class_books OWNER TO reading_buddy;

--
-- Name: class_students; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.class_students (
    class_id integer NOT NULL,
    student_id uuid NOT NULL
);


ALTER TABLE public.class_students OWNER TO reading_buddy;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    teacher_id uuid NOT NULL,
    name text NOT NULL,
    grade_level integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.classes OWNER TO reading_buddy;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO reading_buddy;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: login_broadcasts; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.login_broadcasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    tone text DEFAULT 'info'::text NOT NULL,
    link_label text,
    link_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.login_broadcasts OWNER TO reading_buddy;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    role public.user_role DEFAULT 'STUDENT'::public.user_role NOT NULL,
    full_name text,
    grade integer,
    access_level public.book_access_level,
    points integer DEFAULT 0 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    reading_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_read_date date,
    total_books_completed integer DEFAULT 0 NOT NULL,
    total_pages_read integer DEFAULT 0 NOT NULL,
    total_quizzes_completed integer DEFAULT 0 NOT NULL,
    total_perfect_quizzes integer DEFAULT 0 NOT NULL,
    books_completed integer DEFAULT 0 NOT NULL,
    pages_read integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.profiles OWNER TO reading_buddy;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.profiles IS 'User profiles linked to NextAuth users table';


--
-- Name: COLUMN profiles.user_id; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.profiles.user_id IS 'Reference to NextAuth users.id';


--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.quiz_attempts (
    id integer NOT NULL,
    student_id uuid NOT NULL,
    quiz_id integer NOT NULL,
    answers jsonb NOT NULL,
    score integer NOT NULL,
    submitted_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.quiz_attempts OWNER TO reading_buddy;

--
-- Name: TABLE quiz_attempts; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.quiz_attempts IS 'Student quiz submissions and scores';


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.quiz_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quiz_attempts_id_seq OWNER TO reading_buddy;

--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.quiz_attempts_id_seq OWNED BY public.quiz_attempts.id;


--
-- Name: quiz_checkpoints; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.quiz_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id integer NOT NULL,
    page_number integer NOT NULL,
    quiz_id integer,
    is_required boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by_id uuid
);


ALTER TABLE public.quiz_checkpoints OWNER TO reading_buddy;

--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.quizzes (
    id integer NOT NULL,
    book_id integer NOT NULL,
    created_by_id uuid,
    questions jsonb NOT NULL,
    page_range_start integer,
    page_range_end integer,
    quiz_type character varying(50) DEFAULT 'classroom'::character varying,
    checkpoint_page integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quizzes_quiz_type_check CHECK (((quiz_type)::text = ANY ((ARRAY['checkpoint'::character varying, 'classroom'::character varying])::text[])))
);


ALTER TABLE public.quizzes OWNER TO reading_buddy;

--
-- Name: TABLE quizzes; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.quizzes IS 'Quiz definitions for books';


--
-- Name: quizzes_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.quizzes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quizzes_id_seq OWNER TO reading_buddy;

--
-- Name: quizzes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.quizzes_id_seq OWNED BY public.quizzes.id;


--
-- Name: reading_challenges; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.reading_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    challenge_type character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    goal_criteria jsonb NOT NULL,
    reward_xp integer DEFAULT 0,
    reward_badge_id uuid,
    created_by_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT challenges_type_check CHECK (((challenge_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'event'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.reading_challenges OWNER TO reading_buddy;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_token text NOT NULL,
    user_id uuid NOT NULL,
    expires timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sessions OWNER TO reading_buddy;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.sessions IS 'NextAuth sessions table - stores active sessions';


--
-- Name: COLUMN sessions.session_token; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.sessions.session_token IS 'Unique session identifier (random token)';


--
-- Name: COLUMN sessions.expires; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.sessions.expires IS 'Session expiration timestamp';


--
-- Name: student_achievements; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.student_achievements (
    id integer NOT NULL,
    student_id uuid NOT NULL,
    achievement_id integer NOT NULL,
    earned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.student_achievements OWNER TO reading_buddy;

--
-- Name: student_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.student_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_achievements_id_seq OWNER TO reading_buddy;

--
-- Name: student_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.student_achievements_id_seq OWNED BY public.student_achievements.id;


--
-- Name: student_badges; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.student_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now(),
    book_id integer,
    quiz_id integer,
    metadata jsonb
);


ALTER TABLE public.student_badges OWNER TO reading_buddy;

--
-- Name: TABLE student_badges; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.student_badges IS 'Badges earned by students';


--
-- Name: student_books; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.student_books (
    id integer NOT NULL,
    student_id uuid NOT NULL,
    book_id integer NOT NULL,
    current_page integer DEFAULT 1 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.student_books OWNER TO reading_buddy;

--
-- Name: TABLE student_books; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.student_books IS 'Student reading progress tracking';


--
-- Name: student_books_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.student_books_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_books_id_seq OWNER TO reading_buddy;

--
-- Name: student_books_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.student_books_id_seq OWNED BY public.student_books.id;


--
-- Name: student_challenge_progress; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.student_challenge_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.student_challenge_progress OWNER TO reading_buddy;

--
-- Name: student_checkpoint_progress; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.student_checkpoint_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    checkpoint_id uuid NOT NULL,
    book_id integer NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    quiz_score numeric(5,2),
    attempts integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.student_checkpoint_progress OWNER TO reading_buddy;

--
-- Name: users; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    email text NOT NULL,
    email_verified timestamp with time zone,
    image text,
    password_hash text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO reading_buddy;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.users IS 'NextAuth users table - stores user accounts';


--
-- Name: COLUMN users.email_verified; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.users.email_verified IS 'Timestamp when email was verified (null if not verified)';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt hashed password for credentials provider (null for OAuth-only users)';


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp with time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO reading_buddy;

--
-- Name: TABLE verification_tokens; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.verification_tokens IS 'NextAuth verification tokens - for email verification and password reset';


--
-- Name: weekly_challenge_completions; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.weekly_challenge_completions (
    id integer NOT NULL,
    student_id uuid NOT NULL,
    challenge_id character varying(50) NOT NULL,
    week_number integer NOT NULL,
    year integer NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    xp_awarded integer NOT NULL
);


ALTER TABLE public.weekly_challenge_completions OWNER TO reading_buddy;

--
-- Name: weekly_challenge_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: reading_buddy
--

CREATE SEQUENCE public.weekly_challenge_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.weekly_challenge_completions_id_seq OWNER TO reading_buddy;

--
-- Name: weekly_challenge_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reading_buddy
--

ALTER SEQUENCE public.weekly_challenge_completions_id_seq OWNED BY public.weekly_challenge_completions.id;


--
-- Name: xp_transactions; Type: TABLE; Schema: public; Owner: reading_buddy
--

CREATE TABLE public.xp_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    amount integer NOT NULL,
    source character varying(50) NOT NULL,
    source_id text,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.xp_transactions OWNER TO reading_buddy;

--
-- Name: TABLE xp_transactions; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TABLE public.xp_transactions IS 'XP transaction history for transparency';


--
-- Name: achievements id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.achievements ALTER COLUMN id SET DEFAULT nextval('public.achievements_id_seq'::regclass);


--
-- Name: book_access id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_access ALTER COLUMN id SET DEFAULT nextval('public.book_access_id_seq'::regclass);


--
-- Name: book_render_jobs id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_render_jobs ALTER COLUMN id SET DEFAULT nextval('public.book_render_jobs_id_seq'::regclass);


--
-- Name: books id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.books ALTER COLUMN id SET DEFAULT nextval('public.books_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: quiz_attempts id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_attempts ALTER COLUMN id SET DEFAULT nextval('public.quiz_attempts_id_seq'::regclass);


--
-- Name: quizzes id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quizzes ALTER COLUMN id SET DEFAULT nextval('public.quizzes_id_seq'::regclass);


--
-- Name: student_achievements id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_achievements ALTER COLUMN id SET DEFAULT nextval('public.student_achievements_id_seq'::regclass);


--
-- Name: student_books id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_books ALTER COLUMN id SET DEFAULT nextval('public.student_books_id_seq'::regclass);


--
-- Name: weekly_challenge_completions id; Type: DEFAULT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.weekly_challenge_completions ALTER COLUMN id SET DEFAULT nextval('public.weekly_challenge_completions_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.achievements (id, name, description, badge_url, criteria) FROM stdin;
\.


--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active, book_id, created_by, created_at, updated_at) FROM stdin;
36924fdc-05aa-46c9-8b98-eebe983b4cec	Page Turner	Read 10 pages	/badges/page-turner.svg	custom	{"pages": 10}	bronze	25	reading	1	t	\N	\N	2025-12-15 04:38:46.329771+00	2025-12-15 04:38:46.329771+00
6ae77049-3350-4f60-983e-e512932c3a5a	Avid Reader	Read 50 pages	/badges/avid-reader.svg	custom	{"pages": 50}	silver	75	reading	2	t	\N	\N	2025-12-15 04:38:46.329771+00	2025-12-15 04:38:46.329771+00
e529389b-f910-4cb4-8be7-f5c5fba3b621	Page Master	Read 100 pages	/badges/page-master.svg	custom	{"pages": 100}	gold	150	reading	3	t	\N	\N	2025-12-15 04:38:46.329771+00	2025-12-15 04:38:46.329771+00
486e12cf-5375-46ae-be84-7cd44bc3f02b	Marathon Reader	Read 500 pages	/badges/marathon-reader.svg	custom	{"pages": 500}	platinum	500	reading	4	t	\N	\N	2025-12-15 04:38:46.329771+00	2025-12-15 04:38:46.329771+00
f57b4976-1874-4811-a43b-a3ef6633e8f1	First Book	Complete your first book	/badges/first-book.svg	book_completion	{"books": 1}	bronze	100	milestone	10	t	\N	\N	2025-12-15 04:38:46.331149+00	2025-12-15 04:38:46.331149+00
dfbb940b-ad9d-4a68-9903-08d98fd5a885	Bookworm	Complete 5 books	/badges/bookworm.svg	book_completion	{"books": 5}	silver	250	milestone	11	t	\N	\N	2025-12-15 04:38:46.331149+00	2025-12-15 04:38:46.331149+00
6583ceac-4bab-46ba-9f87-e634b31c2213	Super Reader	Complete 10 books	/badges/super-reader.svg	book_completion	{"books": 10}	gold	500	milestone	12	t	\N	\N	2025-12-15 04:38:46.331149+00	2025-12-15 04:38:46.331149+00
5ba63bcd-6a90-4ede-80f7-3181c00190ac	Reading Champion	Complete 25 books	/badges/reading-champion.svg	book_completion	{"books": 25}	platinum	1000	milestone	13	t	\N	\N	2025-12-15 04:38:46.331149+00	2025-12-15 04:38:46.331149+00
1e1353d5-c15a-48e7-a0c9-d9ce28286992	Quiz Beginner	Complete 1 quiz	/badges/quiz-beginner.svg	quiz_mastery	{"quizzes": 1}	bronze	50	quiz	20	t	\N	\N	2025-12-15 04:38:46.331485+00	2025-12-15 04:38:46.331485+00
25ff53f6-b607-4995-90ae-cf525ec61adb	Quiz Expert	Complete 10 quizzes	/badges/quiz-expert.svg	quiz_mastery	{"quizzes": 10}	silver	150	quiz	21	t	\N	\N	2025-12-15 04:38:46.331485+00	2025-12-15 04:38:46.331485+00
852b88ce-39e2-4442-9cd2-5672258e0637	Perfect Score	Get 100% on a quiz	/badges/perfect-score.svg	quiz_mastery	{"perfect_scores": 1}	gold	200	quiz	22	t	\N	\N	2025-12-15 04:38:46.331485+00	2025-12-15 04:38:46.331485+00
fe677ed7-2ca2-453e-8166-7c2e3fcf65f9	Quiz Master	Complete 25 quizzes	/badges/quiz-master.svg	quiz_mastery	{"quizzes": 25}	platinum	600	quiz	23	t	\N	\N	2025-12-15 04:38:46.331485+00	2025-12-15 04:38:46.331485+00
b567aa33-8fdd-4553-9ce8-7efb0501b723	Reading Streak	3-day reading streak	/badges/reading-streak.svg	streak	{"streak": 3}	bronze	50	streak	30	t	\N	\N	2025-12-15 04:38:46.331793+00	2025-12-15 04:38:46.331793+00
7128c91e-1516-49ad-823e-34ecff28d4ef	Consistent Reader	7-day reading streak	/badges/consistent-reader.svg	streak	{"streak": 7}	silver	100	streak	31	t	\N	\N	2025-12-15 04:38:46.331793+00	2025-12-15 04:38:46.331793+00
70a62c14-f6ae-44b8-9960-9782b90fa5c6	Month of Reading	30-day reading streak	/badges/month-of-reading.svg	streak	{"streak": 30}	gold	300	streak	32	t	\N	\N	2025-12-15 04:38:46.331793+00	2025-12-15 04:38:46.331793+00
8e84a06f-edf9-46da-bc14-185b3a6314e7	Unstoppable	60-day reading streak	/badges/unstoppable.svg	streak	{"streak": 60}	platinum	600	streak	33	t	\N	\N	2025-12-15 04:38:46.331793+00	2025-12-15 04:38:46.331793+00
f23c0188-4c82-424b-a3ba-b5fab868b62a	Early Bird	Read before 8 AM	/badges/early-bird.svg	custom	{"time": "08:00"}	special	50	special	40	t	\N	\N	2025-12-15 04:38:46.332072+00	2025-12-15 04:38:46.332072+00
d83ad9ed-f382-49a3-96ea-bdfa8dd1dca7	Weekend Warrior	Read on Saturday and Sunday	/badges/weekend-warrior.svg	custom	{"weekend": true}	special	100	special	41	t	\N	\N	2025-12-15 04:38:46.332072+00	2025-12-15 04:38:46.332072+00
c7d501c3-ded3-4869-a186-f86094d0e892	Speed Reader	Read 50 pages in one day	/badges/speed-reader.svg	custom	{"pages_per_day": 50}	special	150	special	42	t	\N	\N	2025-12-15 04:38:46.332072+00	2025-12-15 04:38:46.332072+00
59f8eccf-312a-4b52-aee0-f3ca210d2cd2	Checkpoint Champion	Complete 10 checkpoint quizzes	/badges/checkpoint-champion.svg	checkpoint	{"checkpoints": 10}	gold	300	quiz	24	t	\N	\N	2025-12-15 04:38:46.332334+00	2025-12-15 04:38:46.332334+00
\.


--
-- Data for Name: book_access; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.book_access (id, book_id, access_level, created_at) FROM stdin;
\.


--
-- Data for Name: book_render_jobs; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.book_render_jobs (id, book_id, status, total_pages, processed_pages, error_message, started_at, finished_at, created_at) FROM stdin;
\.


--
-- Data for Name: books; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.books (id, title, author, description, category, grade_level, page_count, pdf_url, cover_url, isbn, publisher, publication_year, genre, language, page_images_prefix, page_images_count, page_images_rendered_at, file_format, original_file_url, file_size_bytes, page_text_content, text_extracted_at, text_extraction_method, text_extraction_error, text_extraction_attempts, last_extraction_attempt_at, created_at) FROM stdin;
\.


--
-- Data for Name: class_books; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.class_books (class_id, book_id, assigned_at, due_date) FROM stdin;
\.


--
-- Data for Name: class_students; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.class_students (class_id, student_id) FROM stdin;
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.classes (id, teacher_id, name, grade_level, created_at) FROM stdin;
\.


--
-- Data for Name: login_broadcasts; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.login_broadcasts (id, title, body, tone, link_label, link_url, is_active, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.profiles (id, user_id, email, role, full_name, grade, access_level, points, xp, level, reading_streak, longest_streak, last_read_date, total_books_completed, total_pages_read, total_quizzes_completed, total_perfect_quizzes, books_completed, pages_read, created_at, updated_at) FROM stdin;
6bd599b7-f931-433a-ae7b-a42d51bdf5ff	220c9e34-b4b2-41fe-b70f-c9592eccc28e	faisal@millennia21.id	ADMIN	Faisal Nur Hidayat	\N	LOWER_ELEMENTARY	0	0	1	0	0	\N	0	0	0	0	0	0	2025-12-16 13:20:31.337153+00	2025-12-16 14:06:32.290564+00
\.


--
-- Data for Name: quiz_attempts; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.quiz_attempts (id, student_id, quiz_id, answers, score, submitted_at) FROM stdin;
\.


--
-- Data for Name: quiz_checkpoints; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.quiz_checkpoints (id, book_id, page_number, quiz_id, is_required, created_at, created_by_id) FROM stdin;
\.


--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.quizzes (id, book_id, created_by_id, questions, page_range_start, page_range_end, quiz_type, checkpoint_page, created_at) FROM stdin;
\.


--
-- Data for Name: reading_challenges; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.reading_challenges (id, name, description, challenge_type, start_date, end_date, goal_criteria, reward_xp, reward_badge_id, created_by_id, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.sessions (id, session_token, user_id, expires, created_at) FROM stdin;
\.


--
-- Data for Name: student_achievements; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.student_achievements (id, student_id, achievement_id, earned_at) FROM stdin;
\.


--
-- Data for Name: student_badges; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.student_badges (id, student_id, badge_id, earned_at, book_id, quiz_id, metadata) FROM stdin;
\.


--
-- Data for Name: student_books; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.student_books (id, student_id, book_id, current_page, completed, started_at, completed_at, updated_at) FROM stdin;
\.


--
-- Data for Name: student_challenge_progress; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.student_challenge_progress (id, student_id, challenge_id, progress, completed, completed_at, created_at) FROM stdin;
\.


--
-- Data for Name: student_checkpoint_progress; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.student_checkpoint_progress (id, student_id, checkpoint_id, book_id, completed, completed_at, quiz_score, attempts, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.users (id, name, email, email_verified, image, password_hash, created_at, updated_at) FROM stdin;
220c9e34-b4b2-41fe-b70f-c9592eccc28e	Faisal Nur Hidayat	faisal@millennia21.id	2025-12-16 13:20:31.317097+00	https://lh3.googleusercontent.com/a/ACg8ocJW3O3Eiud0GLv6uY4fjn2l4NuU_lL8NcNiq_Sls9FAkTHgB_rY9w=s96-c	\N	2025-12-16 13:20:31.317097+00	2025-12-16 13:20:31.317097+00
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.verification_tokens (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: weekly_challenge_completions; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.weekly_challenge_completions (id, student_id, challenge_id, week_number, year, completed_at, xp_awarded) FROM stdin;
\.


--
-- Data for Name: xp_transactions; Type: TABLE DATA; Schema: public; Owner: reading_buddy
--

COPY public.xp_transactions (id, student_id, amount, source, source_id, description, created_at) FROM stdin;
\.


--
-- Name: achievements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.achievements_id_seq', 1, false);


--
-- Name: book_access_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.book_access_id_seq', 1, false);


--
-- Name: book_render_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.book_render_jobs_id_seq', 1, false);


--
-- Name: books_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.books_id_seq', 1, false);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.classes_id_seq', 1, false);


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.quiz_attempts_id_seq', 1, false);


--
-- Name: quizzes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.quizzes_id_seq', 1, false);


--
-- Name: student_achievements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.student_achievements_id_seq', 1, false);


--
-- Name: student_books_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.student_books_id_seq', 1, false);


--
-- Name: weekly_challenge_completions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: reading_buddy
--

SELECT pg_catalog.setval('public.weekly_challenge_completions_id_seq', 1, false);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_provider_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_provider_unique UNIQUE (provider, provider_account_id);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: book_access book_access_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_access
    ADD CONSTRAINT book_access_pkey PRIMARY KEY (id);


--
-- Name: book_access book_access_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_access
    ADD CONSTRAINT book_access_unique UNIQUE (book_id, access_level);


--
-- Name: book_render_jobs book_render_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_render_jobs
    ADD CONSTRAINT book_render_jobs_pkey PRIMARY KEY (id);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: class_books class_books_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_books
    ADD CONSTRAINT class_books_pkey PRIMARY KEY (class_id, book_id);


--
-- Name: class_students class_students_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_pkey PRIMARY KEY (class_id, student_id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: login_broadcasts login_broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.login_broadcasts
    ADD CONSTRAINT login_broadcasts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_checkpoints quiz_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_checkpoints
    ADD CONSTRAINT quiz_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: reading_challenges reading_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.reading_challenges
    ADD CONSTRAINT reading_challenges_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: student_achievements student_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_pkey PRIMARY KEY (id);


--
-- Name: student_achievements student_achievements_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_unique UNIQUE (student_id, achievement_id);


--
-- Name: student_badges student_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_pkey PRIMARY KEY (id);


--
-- Name: student_books student_books_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_books
    ADD CONSTRAINT student_books_pkey PRIMARY KEY (id);


--
-- Name: student_books student_books_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_books
    ADD CONSTRAINT student_books_unique UNIQUE (student_id, book_id);


--
-- Name: student_challenge_progress student_challenge_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_challenge_progress
    ADD CONSTRAINT student_challenge_progress_pkey PRIMARY KEY (id);


--
-- Name: student_checkpoint_progress student_checkpoint_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_checkpoint_progress
    ADD CONSTRAINT student_checkpoint_progress_pkey PRIMARY KEY (id);


--
-- Name: badges unique_badge_name; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT unique_badge_name UNIQUE (name);


--
-- Name: quiz_checkpoints unique_book_checkpoint; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_checkpoints
    ADD CONSTRAINT unique_book_checkpoint UNIQUE (book_id, page_number);


--
-- Name: student_badges unique_student_badge_book; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT unique_student_badge_book UNIQUE (student_id, badge_id, book_id);


--
-- Name: student_challenge_progress unique_student_challenge; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_challenge_progress
    ADD CONSTRAINT unique_student_challenge UNIQUE (student_id, challenge_id);


--
-- Name: student_checkpoint_progress unique_student_checkpoint; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_checkpoint_progress
    ADD CONSTRAINT unique_student_checkpoint UNIQUE (student_id, checkpoint_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: weekly_challenge_completions weekly_challenge_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.weekly_challenge_completions
    ADD CONSTRAINT weekly_challenge_completions_pkey PRIMARY KEY (id);


--
-- Name: weekly_challenge_completions weekly_challenge_unique; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.weekly_challenge_completions
    ADD CONSTRAINT weekly_challenge_unique UNIQUE (student_id, challenge_id, week_number, year);


--
-- Name: xp_transactions xp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_provider; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_accounts_provider ON public.accounts USING btree (provider, provider_account_id);


--
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);


--
-- Name: idx_badges_active; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_badges_active ON public.badges USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_badges_type; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_badges_type ON public.badges USING btree (badge_type);


--
-- Name: idx_books_extraction_failed; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_books_extraction_failed ON public.books USING btree (text_extraction_error) WHERE (text_extraction_error IS NOT NULL);


--
-- Name: idx_books_file_format; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_books_file_format ON public.books USING btree (file_format);


--
-- Name: idx_books_text_extracted; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_books_text_extracted ON public.books USING btree (text_extracted_at) WHERE (text_extracted_at IS NOT NULL);


--
-- Name: idx_challenges_active; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_challenges_active ON public.reading_challenges USING btree (is_active, end_date) WHERE (is_active = true);


--
-- Name: idx_checkpoint_progress_checkpoint; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_checkpoint_progress_checkpoint ON public.student_checkpoint_progress USING btree (checkpoint_id);


--
-- Name: idx_checkpoint_progress_incomplete; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_checkpoint_progress_incomplete ON public.student_checkpoint_progress USING btree (student_id, completed) WHERE (completed = false);


--
-- Name: idx_checkpoint_progress_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_checkpoint_progress_student ON public.student_checkpoint_progress USING btree (student_id, book_id);


--
-- Name: idx_checkpoints_book; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_checkpoints_book ON public.quiz_checkpoints USING btree (book_id, page_number);


--
-- Name: idx_checkpoints_quiz; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_checkpoints_quiz ON public.quiz_checkpoints USING btree (quiz_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_level; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_level ON public.profiles USING btree (level DESC);


--
-- Name: idx_profiles_reading_streak; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_reading_streak ON public.profiles USING btree (reading_streak DESC);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_profiles_xp; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_profiles_xp ON public.profiles USING btree (xp DESC);


--
-- Name: idx_quiz_attempts_quiz; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts USING btree (quiz_id);


--
-- Name: idx_quiz_attempts_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts USING btree (student_id);


--
-- Name: idx_quizzes_book; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quizzes_book ON public.quizzes USING btree (book_id);


--
-- Name: idx_quizzes_checkpoint; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quizzes_checkpoint ON public.quizzes USING btree (book_id, checkpoint_page) WHERE ((quiz_type)::text = 'checkpoint'::text);


--
-- Name: idx_quizzes_page_range; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quizzes_page_range ON public.quizzes USING btree (book_id, page_range_start, page_range_end) WHERE (page_range_start IS NOT NULL);


--
-- Name: idx_quizzes_type; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_quizzes_type ON public.quizzes USING btree (quiz_type);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (session_token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_student_badges_badge; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_badges_badge ON public.student_badges USING btree (badge_id);


--
-- Name: idx_student_badges_book; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_badges_book ON public.student_badges USING btree (book_id) WHERE (book_id IS NOT NULL);


--
-- Name: idx_student_badges_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_badges_student ON public.student_badges USING btree (student_id, earned_at DESC);


--
-- Name: idx_student_books_book; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_books_book ON public.student_books USING btree (book_id);


--
-- Name: idx_student_books_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_books_student ON public.student_books USING btree (student_id);


--
-- Name: idx_student_challenge_progress_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_student_challenge_progress_student ON public.student_challenge_progress USING btree (student_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_verification_tokens_identifier; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_verification_tokens_identifier ON public.verification_tokens USING btree (identifier);


--
-- Name: idx_weekly_challenge_completions_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_weekly_challenge_completions_student ON public.weekly_challenge_completions USING btree (student_id);


--
-- Name: idx_weekly_challenge_completions_week; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_weekly_challenge_completions_week ON public.weekly_challenge_completions USING btree (week_number, year);


--
-- Name: idx_xp_transactions_student; Type: INDEX; Schema: public; Owner: reading_buddy
--

CREATE INDEX idx_xp_transactions_student ON public.xp_transactions USING btree (student_id, created_at DESC);


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: badges update_badges_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_badges_updated_at BEFORE UPDATE ON public.badges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: TRIGGER update_badges_updated_at ON badges; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TRIGGER update_badges_updated_at ON public.badges IS 'Auto-update updated_at on badge changes';


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: TRIGGER update_profiles_updated_at ON profiles; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TRIGGER update_profiles_updated_at ON public.profiles IS 'Auto-update updated_at on profile changes';


--
-- Name: student_books update_student_books_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_student_books_updated_at BEFORE UPDATE ON public.student_books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: TRIGGER update_student_books_updated_at ON student_books; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TRIGGER update_student_books_updated_at ON public.student_books IS 'Auto-update updated_at on reading progress changes';


--
-- Name: student_checkpoint_progress update_student_checkpoint_progress_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_student_checkpoint_progress_updated_at BEFORE UPDATE ON public.student_checkpoint_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: TRIGGER update_student_checkpoint_progress_updated_at ON student_checkpoint_progress; Type: COMMENT; Schema: public; Owner: reading_buddy
--

COMMENT ON TRIGGER update_student_checkpoint_progress_updated_at ON public.student_checkpoint_progress IS 'Auto-update updated_at on checkpoint progress changes';


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: reading_buddy
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: badges badges_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE SET NULL;


--
-- Name: badges badges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: book_access book_access_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_access
    ADD CONSTRAINT book_access_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: book_render_jobs book_render_jobs_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.book_render_jobs
    ADD CONSTRAINT book_render_jobs_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: class_books class_books_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_books
    ADD CONSTRAINT class_books_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: class_books class_books_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_books
    ADD CONSTRAINT class_books_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_students class_students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_students class_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: login_broadcasts login_broadcasts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.login_broadcasts
    ADD CONSTRAINT login_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: quiz_attempts quiz_attempts_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quiz_attempts quiz_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: quiz_checkpoints quiz_checkpoints_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_checkpoints
    ADD CONSTRAINT quiz_checkpoints_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: quiz_checkpoints quiz_checkpoints_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_checkpoints
    ADD CONSTRAINT quiz_checkpoints_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: quiz_checkpoints quiz_checkpoints_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quiz_checkpoints
    ADD CONSTRAINT quiz_checkpoints_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE SET NULL;


--
-- Name: quizzes quizzes_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id);


--
-- Name: reading_challenges reading_challenges_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.reading_challenges
    ADD CONSTRAINT reading_challenges_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: reading_challenges reading_challenges_reward_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.reading_challenges
    ADD CONSTRAINT reading_challenges_reward_badge_id_fkey FOREIGN KEY (reward_badge_id) REFERENCES public.badges(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_achievements student_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: student_achievements student_achievements_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_badges student_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: student_badges student_badges_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE SET NULL;


--
-- Name: student_badges student_badges_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE SET NULL;


--
-- Name: student_badges student_badges_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_books student_books_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_books
    ADD CONSTRAINT student_books_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: student_books student_books_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_books
    ADD CONSTRAINT student_books_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_challenge_progress student_challenge_progress_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_challenge_progress
    ADD CONSTRAINT student_challenge_progress_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.reading_challenges(id) ON DELETE CASCADE;


--
-- Name: student_challenge_progress student_challenge_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_challenge_progress
    ADD CONSTRAINT student_challenge_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_checkpoint_progress student_checkpoint_progress_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_checkpoint_progress
    ADD CONSTRAINT student_checkpoint_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: student_checkpoint_progress student_checkpoint_progress_checkpoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_checkpoint_progress
    ADD CONSTRAINT student_checkpoint_progress_checkpoint_id_fkey FOREIGN KEY (checkpoint_id) REFERENCES public.quiz_checkpoints(id) ON DELETE CASCADE;


--
-- Name: student_checkpoint_progress student_checkpoint_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.student_checkpoint_progress
    ADD CONSTRAINT student_checkpoint_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: weekly_challenge_completions weekly_challenge_completions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.weekly_challenge_completions
    ADD CONSTRAINT weekly_challenge_completions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: xp_transactions xp_transactions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reading_buddy
--

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements achievements_manage_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY achievements_manage_admin ON public.achievements USING ((public.get_current_user_role() = 'ADMIN'::public.user_role));


--
-- Name: achievements achievements_select_all; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY achievements_select_all ON public.achievements FOR SELECT USING (true);


--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: badges badges_manage_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY badges_manage_admin ON public.badges USING ((public.get_current_user_role() = 'ADMIN'::public.user_role));


--
-- Name: badges badges_select_active; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY badges_select_active ON public.badges FOR SELECT USING (((is_active = true) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: book_access; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.book_access ENABLE ROW LEVEL SECURITY;

--
-- Name: book_access book_access_manage_librarian_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY book_access_manage_librarian_admin ON public.book_access USING ((public.get_current_user_role() = ANY (ARRAY['LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: book_access book_access_select_all; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY book_access_select_all ON public.book_access FOR SELECT USING (true);


--
-- Name: book_render_jobs; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.book_render_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: book_render_jobs book_render_jobs_manage_librarian_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY book_render_jobs_manage_librarian_admin ON public.book_render_jobs USING ((public.get_current_user_role() = ANY (ARRAY['LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: book_render_jobs book_render_jobs_select_librarian_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY book_render_jobs_select_librarian_admin ON public.book_render_jobs FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: books; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

--
-- Name: books books_delete_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY books_delete_admin ON public.books FOR DELETE USING ((public.get_current_user_role() = 'ADMIN'::public.user_role));


--
-- Name: books books_insert_librarian_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY books_insert_librarian_admin ON public.books FOR INSERT WITH CHECK ((public.get_current_user_role() = ANY (ARRAY['LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: books books_select_authenticated; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY books_select_authenticated ON public.books FOR SELECT USING ((current_setting('app.user_id'::text, true) IS NOT NULL));


--
-- Name: books books_update_librarian_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY books_update_librarian_admin ON public.books FOR UPDATE USING ((public.get_current_user_role() = ANY (ARRAY['LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: class_books; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.class_books ENABLE ROW LEVEL SECURITY;

--
-- Name: class_books class_books_manage_teacher; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_books_manage_teacher ON public.class_books USING ((EXISTS ( SELECT 1
   FROM public.classes
  WHERE ((classes.id = class_books.class_id) AND ((classes.teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])))))));


--
-- Name: class_books class_books_select_student; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_books_select_student ON public.class_books FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.class_students
  WHERE ((class_students.class_id = class_books.class_id) AND (class_students.student_id = public.get_current_profile_id())))));


--
-- Name: class_books class_books_select_teacher; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_books_select_teacher ON public.class_books FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.classes
  WHERE ((classes.id = class_books.class_id) AND ((classes.teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])))))));


--
-- Name: class_students; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

--
-- Name: class_students class_students_manage_teacher; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_students_manage_teacher ON public.class_students USING ((EXISTS ( SELECT 1
   FROM public.classes
  WHERE ((classes.id = class_students.class_id) AND ((classes.teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])))))));


--
-- Name: class_students class_students_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_students_select_own ON public.class_students FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: class_students class_students_select_teacher; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY class_students_select_teacher ON public.class_students FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.classes
  WHERE ((classes.id = class_students.class_id) AND ((classes.teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])))))));


--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_delete_teacher_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY classes_delete_teacher_own ON public.classes FOR DELETE USING (((teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = 'ADMIN'::public.user_role)));


--
-- Name: classes classes_insert_teacher; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY classes_insert_teacher ON public.classes FOR INSERT WITH CHECK (((teacher_id = public.get_current_profile_id()) AND (public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: classes classes_select_student_enrolled; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY classes_select_student_enrolled ON public.classes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.class_students
  WHERE ((class_students.class_id = classes.id) AND (class_students.student_id = public.get_current_profile_id())))));


--
-- Name: classes classes_select_teacher_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY classes_select_teacher_own ON public.classes FOR SELECT USING (((teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: classes classes_update_teacher_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY classes_update_teacher_own ON public.classes FOR UPDATE USING (((teacher_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: login_broadcasts; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.login_broadcasts ENABLE ROW LEVEL SECURITY;

--
-- Name: login_broadcasts login_broadcasts_manage_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY login_broadcasts_manage_admin ON public.login_broadcasts USING ((public.get_current_user_role() = 'ADMIN'::public.user_role));


--
-- Name: login_broadcasts login_broadcasts_select_active; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY login_broadcasts_select_active ON public.login_broadcasts FOR SELECT USING ((is_active = true));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_all; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY profiles_select_all ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE USING ((public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((user_id = (current_setting('app.user_id'::text, true))::uuid));


--
-- Name: quiz_attempts; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_attempts quiz_attempts_insert_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quiz_attempts_insert_own ON public.quiz_attempts FOR INSERT WITH CHECK ((student_id = public.get_current_profile_id()));


--
-- Name: quiz_attempts quiz_attempts_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: quiz_attempts quiz_attempts_select_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quiz_attempts_select_teacher_admin ON public.quiz_attempts FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: quiz_checkpoints; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.quiz_checkpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_checkpoints quiz_checkpoints_manage_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quiz_checkpoints_manage_teacher_admin ON public.quiz_checkpoints USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: quiz_checkpoints quiz_checkpoints_select_all; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quiz_checkpoints_select_all ON public.quiz_checkpoints FOR SELECT USING (true);


--
-- Name: quizzes; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

--
-- Name: quizzes quizzes_delete_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quizzes_delete_own ON public.quizzes FOR DELETE USING (((created_by_id = public.get_current_profile_id()) OR (public.get_current_user_role() = 'ADMIN'::public.user_role)));


--
-- Name: quizzes quizzes_insert_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quizzes_insert_teacher_admin ON public.quizzes FOR INSERT WITH CHECK (((created_by_id = public.get_current_profile_id()) AND (public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role]))));


--
-- Name: quizzes quizzes_select_student_assigned; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quizzes_select_student_assigned ON public.quizzes FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.class_books cb
     JOIN public.class_students cs ON ((cb.class_id = cs.class_id)))
  WHERE ((cb.book_id = quizzes.book_id) AND (cs.student_id = public.get_current_profile_id())))) OR (EXISTS ( SELECT 1
   FROM public.student_books sb
  WHERE ((sb.book_id = quizzes.book_id) AND (sb.student_id = public.get_current_profile_id()))))));


--
-- Name: quizzes quizzes_select_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quizzes_select_teacher_admin ON public.quizzes FOR SELECT USING (((created_by_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: quizzes quizzes_update_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY quizzes_update_own ON public.quizzes FOR UPDATE USING (((created_by_id = public.get_current_profile_id()) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: reading_challenges; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.reading_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: reading_challenges reading_challenges_manage_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY reading_challenges_manage_admin ON public.reading_challenges USING ((public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role])));


--
-- Name: reading_challenges reading_challenges_select_active; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY reading_challenges_select_active ON public.reading_challenges FOR SELECT USING (((is_active = true) OR (public.get_current_user_role() = ANY (ARRAY['ADMIN'::public.user_role, 'LIBRARIAN'::public.user_role]))));


--
-- Name: student_achievements; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: student_achievements student_achievements_insert_system; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_achievements_insert_system ON public.student_achievements FOR INSERT WITH CHECK (true);


--
-- Name: student_achievements student_achievements_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_achievements_select_own ON public.student_achievements FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_achievements student_achievements_select_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_achievements_select_teacher_admin ON public.student_achievements FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: student_badges; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: student_badges student_badges_insert_system; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_badges_insert_system ON public.student_badges FOR INSERT WITH CHECK (true);


--
-- Name: student_badges student_badges_select_all_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_badges_select_all_admin ON public.student_badges FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: student_badges student_badges_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_badges_select_own ON public.student_badges FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_books; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;

--
-- Name: student_books student_books_delete_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_books_delete_own ON public.student_books FOR DELETE USING (((student_id = public.get_current_profile_id()) OR (public.get_current_user_role() = 'ADMIN'::public.user_role)));


--
-- Name: student_books student_books_insert_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_books_insert_own ON public.student_books FOR INSERT WITH CHECK ((student_id = public.get_current_profile_id()));


--
-- Name: student_books student_books_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_books_select_own ON public.student_books FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_books student_books_select_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_books_select_teacher_admin ON public.student_books FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: student_books student_books_update_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_books_update_own ON public.student_books FOR UPDATE USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_challenge_progress; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.student_challenge_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: student_challenge_progress student_challenge_progress_insert_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_challenge_progress_insert_own ON public.student_challenge_progress FOR INSERT WITH CHECK ((student_id = public.get_current_profile_id()));


--
-- Name: student_challenge_progress student_challenge_progress_select_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_challenge_progress_select_admin ON public.student_challenge_progress FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: student_challenge_progress student_challenge_progress_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_challenge_progress_select_own ON public.student_challenge_progress FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_challenge_progress student_challenge_progress_update_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_challenge_progress_update_own ON public.student_challenge_progress FOR UPDATE USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_checkpoint_progress; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.student_checkpoint_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: student_checkpoint_progress student_checkpoint_progress_insert_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_checkpoint_progress_insert_own ON public.student_checkpoint_progress FOR INSERT WITH CHECK ((student_id = public.get_current_profile_id()));


--
-- Name: student_checkpoint_progress student_checkpoint_progress_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_checkpoint_progress_select_own ON public.student_checkpoint_progress FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: student_checkpoint_progress student_checkpoint_progress_select_teacher_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_checkpoint_progress_select_teacher_admin ON public.student_checkpoint_progress FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: student_checkpoint_progress student_checkpoint_progress_update_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY student_checkpoint_progress_update_own ON public.student_checkpoint_progress FOR UPDATE USING ((student_id = public.get_current_profile_id()));


--
-- Name: weekly_challenge_completions; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.weekly_challenge_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_challenge_completions weekly_challenge_completions_insert_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY weekly_challenge_completions_insert_own ON public.weekly_challenge_completions FOR INSERT WITH CHECK ((student_id = public.get_current_profile_id()));


--
-- Name: weekly_challenge_completions weekly_challenge_completions_select_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY weekly_challenge_completions_select_admin ON public.weekly_challenge_completions FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: weekly_challenge_completions weekly_challenge_completions_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY weekly_challenge_completions_select_own ON public.weekly_challenge_completions FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- Name: xp_transactions; Type: ROW SECURITY; Schema: public; Owner: reading_buddy
--

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_transactions xp_transactions_insert_system; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY xp_transactions_insert_system ON public.xp_transactions FOR INSERT WITH CHECK (true);


--
-- Name: xp_transactions xp_transactions_select_admin; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY xp_transactions_select_admin ON public.xp_transactions FOR SELECT USING ((public.get_current_user_role() = ANY (ARRAY['TEACHER'::public.user_role, 'LIBRARIAN'::public.user_role, 'ADMIN'::public.user_role])));


--
-- Name: xp_transactions xp_transactions_select_own; Type: POLICY; Schema: public; Owner: reading_buddy
--

CREATE POLICY xp_transactions_select_own ON public.xp_transactions FOR SELECT USING ((student_id = public.get_current_profile_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict 8gpv4nNpuYBATultC26DRGqc88yGkYzc5rg0MtQPcW4OM9bNwkVQpBPRTyjSUU8

