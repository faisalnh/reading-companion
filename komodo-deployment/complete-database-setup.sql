-- ==========================================
-- Reading Buddy - PostgreSQL Extensions
-- Self-Hosted Version
-- ==========================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram matching for text search (used for book search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Comments
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for password hashing and tokens';
COMMENT ON EXTENSION "pg_trgm" IS 'Trigram matching for fuzzy text search';
-- ==========================================
-- NextAuth.js Database Schema
-- Required tables for NextAuth v5 (Auth.js)
-- ==========================================

-- Users table (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  image TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth accounts (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'oauth', 'email', 'credentials'
  provider TEXT NOT NULL, -- 'google', 'github', etc.
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT accounts_provider_unique UNIQUE(provider, provider_account_id)
);

-- Sessions table (database session strategy)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification tokens (email verification, password reset)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL, -- email or user id
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier ON verification_tokens(identifier);

-- ==========================================
-- Triggers for Updated Timestamps
-- ==========================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for accounts table
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Comments
-- ==========================================

COMMENT ON TABLE users IS 'NextAuth users table - stores user accounts';
COMMENT ON TABLE accounts IS 'NextAuth accounts table - stores OAuth and provider linkages';
COMMENT ON TABLE sessions IS 'NextAuth sessions table - stores active sessions';
COMMENT ON TABLE verification_tokens IS 'NextAuth verification tokens - for email verification and password reset';

COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for credentials provider (null for OAuth-only users)';
COMMENT ON COLUMN users.email_verified IS 'Timestamp when email was verified (null if not verified)';
COMMENT ON COLUMN sessions.session_token IS 'Unique session identifier (random token)';
COMMENT ON COLUMN sessions.expires IS 'Session expiration timestamp';
-- ==========================================
-- Reading Buddy Application Schema
-- Self-Hosted Version (adapted from Supabase)
-- ==========================================

-- ============================================================================
-- PART 1: ENUMS AND TYPES
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'LIBRARIAN', 'ADMIN');

-- Book access levels
CREATE TYPE book_access_level AS ENUM (
  'KINDERGARTEN',
  'LOWER_ELEMENTARY',
  'UPPER_ELEMENTARY',
  'JUNIOR_HIGH',
  'TEACHERS_STAFF'
);

-- Badge types
CREATE TYPE badge_type AS ENUM ('checkpoint', 'quiz_mastery', 'book_completion', 'streak', 'custom');

-- Quiz types
CREATE TYPE quiz_type AS ENUM ('checkpoint', 'classroom');

-- ============================================================================
-- PART 2: CORE TABLES
-- ============================================================================

-- Profiles table (now links to NextAuth users instead of auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT,
  grade INT,
  access_level book_access_level,
  points INT NOT NULL DEFAULT 0,
  -- Gamification fields
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  reading_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_read_date DATE,
  total_books_completed INT NOT NULL DEFAULT 0,
  total_pages_read INT NOT NULL DEFAULT 0,
  total_quizzes_completed INT NOT NULL DEFAULT 0,
  total_perfect_quizzes INT NOT NULL DEFAULT 0,
  books_completed INT NOT NULL DEFAULT 0,
  pages_read INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_user_id_unique UNIQUE(user_id)
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  category TEXT,
  grade_level INT,
  page_count INT,
  pdf_url TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  isbn TEXT,
  publisher TEXT,
  publication_year INT,
  genre TEXT,
  language TEXT,
  page_images_prefix TEXT,
  page_images_count INT,
  page_images_rendered_at TIMESTAMPTZ,
  -- Multi-format support
  file_format VARCHAR(20) DEFAULT 'pdf',
  original_file_url TEXT,
  file_size_bytes BIGINT,
  -- Text extraction
  page_text_content JSONB,
  text_extracted_at TIMESTAMPTZ,
  text_extraction_method VARCHAR(50),
  text_extraction_error TEXT,
  text_extraction_attempts INTEGER DEFAULT 0,
  last_extraction_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book access levels
CREATE TABLE IF NOT EXISTS book_access (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  access_level book_access_level NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT book_access_unique UNIQUE (book_id, access_level)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class students (many-to-many)
CREATE TABLE IF NOT EXISTS class_students (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

-- Class books (many-to-many assignments)
CREATE TABLE IF NOT EXISTS class_books (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  book_id INT REFERENCES books(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  PRIMARY KEY (class_id, book_id)
);

-- Book render jobs
CREATE TABLE IF NOT EXISTS book_render_jobs (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_pages INT,
  processed_pages INT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student reading progress
CREATE TABLE IF NOT EXISTS student_books (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_page INT NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_books_unique UNIQUE(student_id, book_id)
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES profiles(id),
  questions JSONB NOT NULL,
  page_range_start INTEGER,
  page_range_end INTEGER,
  quiz_type VARCHAR(50) DEFAULT 'classroom',
  checkpoint_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT quizzes_quiz_type_check CHECK (quiz_type IN ('checkpoint', 'classroom'))
);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements definitions (legacy)
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  badge_url TEXT NOT NULL,
  criteria JSONB
);

-- Student achievements (earned - legacy)
CREATE TABLE IF NOT EXISTS student_achievements (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_achievements_unique UNIQUE(student_id, achievement_id)
);

-- Quiz checkpoints
CREATE TABLE IF NOT EXISTS quiz_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT unique_book_checkpoint UNIQUE(book_id, page_number)
);

-- Student checkpoint progress
CREATE TABLE IF NOT EXISTS student_checkpoint_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES quiz_checkpoints(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  quiz_score DECIMAL(5,2),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_checkpoint UNIQUE(student_id, checkpoint_id)
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url TEXT,
  badge_type VARCHAR(50) NOT NULL,
  criteria JSONB NOT NULL,
  tier VARCHAR(20) DEFAULT 'bronze',
  xp_reward INTEGER DEFAULT 0,
  category VARCHAR(50),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_badge_name UNIQUE(name),
  CONSTRAINT badges_badge_type_check CHECK (badge_type IN ('checkpoint', 'quiz_mastery', 'book_completion', 'streak', 'custom'))
);

-- Student badges earned
CREATE TABLE IF NOT EXISTS student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  metadata JSONB,
  CONSTRAINT unique_student_badge_book UNIQUE(student_id, badge_id, book_id)
);

-- XP transactions (audit trail)
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reading challenges
CREATE TABLE IF NOT EXISTS reading_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  goal_criteria JSONB NOT NULL,
  reward_xp INTEGER DEFAULT 0,
  reward_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT challenges_type_check CHECK (challenge_type IN ('daily', 'weekly', 'monthly', 'event', 'custom'))
);

-- Student challenge progress
CREATE TABLE IF NOT EXISTS student_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES reading_challenges(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_challenge UNIQUE(student_id, challenge_id)
);

-- Login broadcasts
CREATE TABLE IF NOT EXISTS login_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'info',
  link_label TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly challenge completions
CREATE TABLE IF NOT EXISTS weekly_challenge_completions (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id VARCHAR(50) NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  xp_awarded INT NOT NULL,
  CONSTRAINT weekly_challenge_unique UNIQUE(student_id, challenge_id, week_number, year)
);

-- ============================================================================
-- PART 3: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_reading_streak ON profiles(reading_streak DESC);

-- Books indexes
CREATE INDEX IF NOT EXISTS idx_books_text_extracted ON books(text_extracted_at) WHERE text_extracted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_extraction_failed ON books(text_extraction_error) WHERE text_extraction_error IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_file_format ON books(file_format);

-- Student books indexes
CREATE INDEX IF NOT EXISTS idx_student_books_student ON student_books(student_id);
CREATE INDEX IF NOT EXISTS idx_student_books_book ON student_books(book_id);

-- Quizzes indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_book ON quizzes(book_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_type ON quizzes(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quizzes_checkpoint ON quizzes(book_id, checkpoint_page) WHERE quiz_type = 'checkpoint';
CREATE INDEX IF NOT EXISTS idx_quizzes_page_range ON quizzes(book_id, page_range_start, page_range_end) WHERE page_range_start IS NOT NULL;

-- Quiz attempts indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- Quiz checkpoints indexes
CREATE INDEX IF NOT EXISTS idx_checkpoints_book ON quiz_checkpoints(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_checkpoints_quiz ON quiz_checkpoints(quiz_id);

-- Student checkpoint progress indexes
CREATE INDEX IF NOT EXISTS idx_checkpoint_progress_student ON student_checkpoint_progress(student_id, book_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_progress_incomplete ON student_checkpoint_progress(student_id, completed) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_checkpoint_progress_checkpoint ON student_checkpoint_progress(checkpoint_id);

-- Badges indexes
CREATE INDEX IF NOT EXISTS idx_badges_type ON badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_active ON badges(is_active) WHERE is_active = true;

-- Student badges indexes
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges(student_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_badges_badge ON student_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_book ON student_badges(book_id) WHERE book_id IS NOT NULL;

-- XP transactions indexes
CREATE INDEX IF NOT EXISTS idx_xp_transactions_student ON xp_transactions(student_id, created_at DESC);

-- Challenge indexes
CREATE INDEX IF NOT EXISTS idx_challenges_active ON reading_challenges(is_active, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_student_challenge_progress_student ON student_challenge_progress(student_id);

-- Weekly challenge indexes
CREATE INDEX IF NOT EXISTS idx_weekly_challenge_completions_student ON weekly_challenge_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_challenge_completions_week ON weekly_challenge_completions(week_number, year);

-- ============================================================================
-- PART 4: COMMENTS
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles linked to NextAuth users table';
COMMENT ON COLUMN profiles.user_id IS 'Reference to NextAuth users.id';
COMMENT ON TABLE books IS 'Book catalog with multi-format support';
COMMENT ON TABLE student_books IS 'Student reading progress tracking';
COMMENT ON TABLE quizzes IS 'Quiz definitions for books';
COMMENT ON TABLE quiz_attempts IS 'Student quiz submissions and scores';
COMMENT ON TABLE badges IS 'Achievement badge definitions';
COMMENT ON TABLE student_badges IS 'Badges earned by students';
COMMENT ON TABLE xp_transactions IS 'XP transaction history for transparency';
-- ==========================================
-- Reading Buddy Database Functions
-- Self-Hosted Version (adapted from Supabase)
-- ==========================================

-- ============================================================================
-- GAMIFICATION FUNCTIONS
-- ============================================================================

-- Calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Formula: level = floor(sqrt(xp / 50)) + 1, capped at 100
  RETURN LEAST(FLOOR(SQRT(xp_amount::FLOAT / 50)) + 1, 100);
END;
$$;

COMMENT ON FUNCTION calculate_level(INTEGER) IS 'Calculate user level from XP amount';

-- Calculate XP needed for a specific level
CREATE OR REPLACE FUNCTION xp_for_level(level_num INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Inverse of level formula: xp = 50 * (level - 1)^2
  RETURN 50 * POWER(level_num - 1, 2);
END;
$$;

COMMENT ON FUNCTION xp_for_level(INTEGER) IS 'Calculate XP required for specific level';

-- Award XP to student
CREATE OR REPLACE FUNCTION award_xp(
  p_student_id UUID,
  p_amount INTEGER,
  p_source VARCHAR(50),
  p_source_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, level_up BOOLEAN)
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

COMMENT ON FUNCTION award_xp IS 'Award XP to student and update level';

-- Update reading streak
CREATE OR REPLACE FUNCTION update_reading_streak(p_student_id UUID)
RETURNS TABLE(current_streak INTEGER, is_new_streak BOOLEAN)
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

COMMENT ON FUNCTION update_reading_streak IS 'Update daily reading streak for student';

-- Check book-specific badges
CREATE OR REPLACE FUNCTION check_book_specific_badge(
  p_student_id UUID,
  p_book_id INTEGER
)
RETURNS TABLE(badge_id UUID, badge_name VARCHAR, already_earned BOOLEAN)
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

COMMENT ON FUNCTION check_book_specific_badge IS 'Check if student has earned book-specific badges';

-- ============================================================================
-- PROFILE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Create or update profile (called from NextAuth)
CREATE OR REPLACE FUNCTION create_or_update_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_role user_role DEFAULT 'STUDENT'
)
RETURNS UUID
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

COMMENT ON FUNCTION create_or_update_profile IS 'Create or update user profile from NextAuth';

-- ============================================================================
-- ADMIN FUNCTIONS
-- ============================================================================

-- Get all user emails (admin only)
CREATE OR REPLACE FUNCTION get_all_user_emails()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role user_role
)
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION get_all_user_emails IS 'Get all user emails (ADMIN only)';

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically update updated_at timestamp';
-- ==========================================
-- Reading Buddy Database Triggers
-- Self-Hosted Version
-- ==========================================

-- ============================================================================
-- AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for student_checkpoint_progress table
CREATE TRIGGER update_student_checkpoint_progress_updated_at
  BEFORE UPDATE ON student_checkpoint_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for badges table
CREATE TRIGGER update_badges_updated_at
  BEFORE UPDATE ON badges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for student_books table
CREATE TRIGGER update_student_books_updated_at
  BEFORE UPDATE ON student_books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TRIGGER update_profiles_updated_at ON profiles IS 'Auto-update updated_at on profile changes';
COMMENT ON TRIGGER update_student_checkpoint_progress_updated_at ON student_checkpoint_progress IS 'Auto-update updated_at on checkpoint progress changes';
COMMENT ON TRIGGER update_badges_updated_at ON badges IS 'Auto-update updated_at on badge changes';
COMMENT ON TRIGGER update_student_books_updated_at ON student_books IS 'Auto-update updated_at on reading progress changes';
-- ==========================================
-- Reading Buddy Row Level Security Policies
-- Self-Hosted Version (using session context)
-- ==========================================

-- Note: Self-hosted uses current_setting('app.user_id') instead of auth.uid()
-- The middleware sets this session variable for each request

-- ============================================================================
-- HELPER FUNCTION FOR RLS
-- ============================================================================

-- Get current user's profile ID from session
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM profiles
  WHERE user_id = current_setting('app.user_id', TRUE)::UUID
  LIMIT 1;
$$;

-- Get current user's role from session
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM profiles
  WHERE user_id = current_setting('app.user_id', TRUE)::UUID
  LIMIT 1;
$$;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_checkpoint_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_challenge_completions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = current_setting('app.user_id', TRUE)::UUID);

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (get_current_user_role() IN ('ADMIN', 'LIBRARIAN'));

-- ============================================================================
-- BOOKS POLICIES
-- ============================================================================

CREATE POLICY "books_select_authenticated"
  ON books FOR SELECT
  USING (current_setting('app.user_id', TRUE) IS NOT NULL);

CREATE POLICY "books_insert_librarian_admin"
  ON books FOR INSERT
  WITH CHECK (get_current_user_role() IN ('LIBRARIAN', 'ADMIN'));

CREATE POLICY "books_update_librarian_admin"
  ON books FOR UPDATE
  USING (get_current_user_role() IN ('LIBRARIAN', 'ADMIN'));

CREATE POLICY "books_delete_admin"
  ON books FOR DELETE
  USING (get_current_user_role() = 'ADMIN');

-- ============================================================================
-- BOOK ACCESS POLICIES
-- ============================================================================

CREATE POLICY "book_access_select_all"
  ON book_access FOR SELECT
  USING (true);

CREATE POLICY "book_access_manage_librarian_admin"
  ON book_access FOR ALL
  USING (get_current_user_role() IN ('LIBRARIAN', 'ADMIN'));

-- ============================================================================
-- CLASSES POLICIES
-- ============================================================================

CREATE POLICY "classes_select_teacher_own"
  ON classes FOR SELECT
  USING (
    teacher_id = get_current_profile_id()
    OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
  );

CREATE POLICY "classes_select_student_enrolled"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_students
      WHERE class_id = classes.id
      AND student_id = get_current_profile_id()
    )
  );

CREATE POLICY "classes_insert_teacher"
  ON classes FOR INSERT
  WITH CHECK (
    teacher_id = get_current_profile_id()
    AND get_current_user_role() IN ('TEACHER', 'ADMIN', 'LIBRARIAN')
  );

CREATE POLICY "classes_update_teacher_own"
  ON classes FOR UPDATE
  USING (
    teacher_id = get_current_profile_id()
    OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
  );

CREATE POLICY "classes_delete_teacher_own"
  ON classes FOR DELETE
  USING (
    teacher_id = get_current_profile_id()
    OR get_current_user_role() = 'ADMIN'
  );

-- ============================================================================
-- CLASS STUDENTS POLICIES
-- ============================================================================

CREATE POLICY "class_students_select_teacher"
  ON class_students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_students.class_id
      AND (
        classes.teacher_id = get_current_profile_id()
        OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
      )
    )
  );

CREATE POLICY "class_students_select_own"
  ON class_students FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "class_students_manage_teacher"
  ON class_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_students.class_id
      AND (
        classes.teacher_id = get_current_profile_id()
        OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
      )
    )
  );

-- ============================================================================
-- CLASS BOOKS POLICIES
-- ============================================================================

CREATE POLICY "class_books_select_teacher"
  ON class_books FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_books.class_id
      AND (
        classes.teacher_id = get_current_profile_id()
        OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
      )
    )
  );

CREATE POLICY "class_books_select_student"
  ON class_books FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_students
      WHERE class_students.class_id = class_books.class_id
      AND class_students.student_id = get_current_profile_id()
    )
  );

CREATE POLICY "class_books_manage_teacher"
  ON class_books FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_books.class_id
      AND (
        classes.teacher_id = get_current_profile_id()
        OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
      )
    )
  );

-- ============================================================================
-- BOOK RENDER JOBS POLICIES
-- ============================================================================

CREATE POLICY "book_render_jobs_select_librarian_admin"
  ON book_render_jobs FOR SELECT
  USING (get_current_user_role() IN ('LIBRARIAN', 'ADMIN'));

CREATE POLICY "book_render_jobs_manage_librarian_admin"
  ON book_render_jobs FOR ALL
  USING (get_current_user_role() IN ('LIBRARIAN', 'ADMIN'));

-- ============================================================================
-- STUDENT BOOKS POLICIES
-- ============================================================================

CREATE POLICY "student_books_select_own"
  ON student_books FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_books_select_teacher_admin"
  ON student_books FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "student_books_insert_own"
  ON student_books FOR INSERT
  WITH CHECK (student_id = get_current_profile_id());

CREATE POLICY "student_books_update_own"
  ON student_books FOR UPDATE
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_books_delete_own"
  ON student_books FOR DELETE
  USING (
    student_id = get_current_profile_id()
    OR get_current_user_role() = 'ADMIN'
  );

-- ============================================================================
-- QUIZZES POLICIES
-- ============================================================================

CREATE POLICY "quizzes_select_teacher_admin"
  ON quizzes FOR SELECT
  USING (
    created_by_id = get_current_profile_id()
    OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
  );

CREATE POLICY "quizzes_select_student_assigned"
  ON quizzes FOR SELECT
  USING (
    -- Student can see quizzes for books in their assigned classes
    EXISTS (
      SELECT 1 FROM class_books cb
      JOIN class_students cs ON cb.class_id = cs.class_id
      WHERE cb.book_id = quizzes.book_id
      AND cs.student_id = get_current_profile_id()
    )
    OR
    -- Student can see quizzes for books they're reading
    EXISTS (
      SELECT 1 FROM student_books sb
      WHERE sb.book_id = quizzes.book_id
      AND sb.student_id = get_current_profile_id()
    )
  );

CREATE POLICY "quizzes_insert_teacher_admin"
  ON quizzes FOR INSERT
  WITH CHECK (
    created_by_id = get_current_profile_id()
    AND get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN')
  );

CREATE POLICY "quizzes_update_own"
  ON quizzes FOR UPDATE
  USING (
    created_by_id = get_current_profile_id()
    OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN')
  );

CREATE POLICY "quizzes_delete_own"
  ON quizzes FOR DELETE
  USING (
    created_by_id = get_current_profile_id()
    OR get_current_user_role() = 'ADMIN'
  );

-- ============================================================================
-- QUIZ ATTEMPTS POLICIES
-- ============================================================================

CREATE POLICY "quiz_attempts_select_own"
  ON quiz_attempts FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "quiz_attempts_select_teacher_admin"
  ON quiz_attempts FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "quiz_attempts_insert_own"
  ON quiz_attempts FOR INSERT
  WITH CHECK (student_id = get_current_profile_id());

-- No update/delete - quiz attempts are immutable

-- ============================================================================
-- ACHIEVEMENTS POLICIES (Legacy)
-- ============================================================================

CREATE POLICY "achievements_select_all"
  ON achievements FOR SELECT
  USING (true);

CREATE POLICY "achievements_manage_admin"
  ON achievements FOR ALL
  USING (get_current_user_role() = 'ADMIN');

CREATE POLICY "student_achievements_select_own"
  ON student_achievements FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_achievements_select_teacher_admin"
  ON student_achievements FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "student_achievements_insert_system"
  ON student_achievements FOR INSERT
  WITH CHECK (true); -- System can award achievements

-- ============================================================================
-- QUIZ CHECKPOINTS POLICIES
-- ============================================================================

CREATE POLICY "quiz_checkpoints_select_all"
  ON quiz_checkpoints FOR SELECT
  USING (true);

CREATE POLICY "quiz_checkpoints_manage_teacher_admin"
  ON quiz_checkpoints FOR ALL
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

-- ============================================================================
-- STUDENT CHECKPOINT PROGRESS POLICIES
-- ============================================================================

CREATE POLICY "student_checkpoint_progress_select_own"
  ON student_checkpoint_progress FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_checkpoint_progress_select_teacher_admin"
  ON student_checkpoint_progress FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "student_checkpoint_progress_insert_own"
  ON student_checkpoint_progress FOR INSERT
  WITH CHECK (student_id = get_current_profile_id());

CREATE POLICY "student_checkpoint_progress_update_own"
  ON student_checkpoint_progress FOR UPDATE
  USING (student_id = get_current_profile_id());

-- ============================================================================
-- BADGES POLICIES
-- ============================================================================

CREATE POLICY "badges_select_active"
  ON badges FOR SELECT
  USING (is_active = true OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN'));

CREATE POLICY "badges_manage_admin"
  ON badges FOR ALL
  USING (get_current_user_role() = 'ADMIN');

CREATE POLICY "student_badges_select_own"
  ON student_badges FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_badges_select_all_admin"
  ON student_badges FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "student_badges_insert_system"
  ON student_badges FOR INSERT
  WITH CHECK (true); -- System can award badges

-- ============================================================================
-- XP TRANSACTIONS POLICIES
-- ============================================================================

CREATE POLICY "xp_transactions_select_own"
  ON xp_transactions FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "xp_transactions_select_admin"
  ON xp_transactions FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "xp_transactions_insert_system"
  ON xp_transactions FOR INSERT
  WITH CHECK (true); -- System can create XP transactions

-- ============================================================================
-- READING CHALLENGES POLICIES
-- ============================================================================

CREATE POLICY "reading_challenges_select_active"
  ON reading_challenges FOR SELECT
  USING (is_active = true OR get_current_user_role() IN ('ADMIN', 'LIBRARIAN'));

CREATE POLICY "reading_challenges_manage_admin"
  ON reading_challenges FOR ALL
  USING (get_current_user_role() IN ('ADMIN', 'LIBRARIAN'));

CREATE POLICY "student_challenge_progress_select_own"
  ON student_challenge_progress FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "student_challenge_progress_select_admin"
  ON student_challenge_progress FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "student_challenge_progress_insert_own"
  ON student_challenge_progress FOR INSERT
  WITH CHECK (student_id = get_current_profile_id());

CREATE POLICY "student_challenge_progress_update_own"
  ON student_challenge_progress FOR UPDATE
  USING (student_id = get_current_profile_id());

-- ============================================================================
-- LOGIN BROADCASTS POLICIES
-- ============================================================================

CREATE POLICY "login_broadcasts_select_active"
  ON login_broadcasts FOR SELECT
  USING (is_active = true);

CREATE POLICY "login_broadcasts_manage_admin"
  ON login_broadcasts FOR ALL
  USING (get_current_user_role() = 'ADMIN');

-- ============================================================================
-- WEEKLY CHALLENGE COMPLETIONS POLICIES
-- ============================================================================

CREATE POLICY "weekly_challenge_completions_select_own"
  ON weekly_challenge_completions FOR SELECT
  USING (student_id = get_current_profile_id());

CREATE POLICY "weekly_challenge_completions_select_admin"
  ON weekly_challenge_completions FOR SELECT
  USING (get_current_user_role() IN ('TEACHER', 'LIBRARIAN', 'ADMIN'));

CREATE POLICY "weekly_challenge_completions_insert_own"
  ON weekly_challenge_completions FOR INSERT
  WITH CHECK (student_id = get_current_profile_id());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_current_profile_id IS 'Get current users profile ID from session context';
COMMENT ON FUNCTION get_current_user_role IS 'Get current users role from session context';
-- ==========================================
-- Reading Buddy Seed Data
-- Self-Hosted Version
-- Optional default badges and achievements
-- ==========================================

-- Note: This file is optional and provides default gamification data
-- You can customize or skip this based on your needs

-- ============================================================================
-- DEFAULT BADGES
-- ============================================================================

-- Reading Badges
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'Page Turner', 'Read 10 pages', '/badges/page-turner.svg', 'custom', '{"pages": 10}'::jsonb, 'bronze', 25, 'reading', 1, true),
  (gen_random_uuid(), 'Avid Reader', 'Read 50 pages', '/badges/avid-reader.svg', 'custom', '{"pages": 50}'::jsonb, 'silver', 75, 'reading', 2, true),
  (gen_random_uuid(), 'Page Master', 'Read 100 pages', '/badges/page-master.svg', 'custom', '{"pages": 100}'::jsonb, 'gold', 150, 'reading', 3, true),
  (gen_random_uuid(), 'Marathon Reader', 'Read 500 pages', '/badges/marathon-reader.svg', 'custom', '{"pages": 500}'::jsonb, 'platinum', 500, 'reading', 4, true)
ON CONFLICT (name) DO NOTHING;

-- Book Completion Badges
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'First Book', 'Complete your first book', '/badges/first-book.svg', 'book_completion', '{"books": 1}'::jsonb, 'bronze', 100, 'milestone', 10, true),
  (gen_random_uuid(), 'Bookworm', 'Complete 5 books', '/badges/bookworm.svg', 'book_completion', '{"books": 5}'::jsonb, 'silver', 250, 'milestone', 11, true),
  (gen_random_uuid(), 'Super Reader', 'Complete 10 books', '/badges/super-reader.svg', 'book_completion', '{"books": 10}'::jsonb, 'gold', 500, 'milestone', 12, true),
  (gen_random_uuid(), 'Reading Champion', 'Complete 25 books', '/badges/reading-champion.svg', 'book_completion', '{"books": 25}'::jsonb, 'platinum', 1000, 'milestone', 13, true)
ON CONFLICT (name) DO NOTHING;

-- Quiz Badges
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'Quiz Beginner', 'Complete 1 quiz', '/badges/quiz-beginner.svg', 'quiz_mastery', '{"quizzes": 1}'::jsonb, 'bronze', 50, 'quiz', 20, true),
  (gen_random_uuid(), 'Quiz Expert', 'Complete 10 quizzes', '/badges/quiz-expert.svg', 'quiz_mastery', '{"quizzes": 10}'::jsonb, 'silver', 150, 'quiz', 21, true),
  (gen_random_uuid(), 'Perfect Score', 'Get 100% on a quiz', '/badges/perfect-score.svg', 'quiz_mastery', '{"perfect_scores": 1}'::jsonb, 'gold', 200, 'quiz', 22, true),
  (gen_random_uuid(), 'Quiz Master', 'Complete 25 quizzes', '/badges/quiz-master.svg', 'quiz_mastery', '{"quizzes": 25}'::jsonb, 'platinum', 600, 'quiz', 23, true)
ON CONFLICT (name) DO NOTHING;

-- Streak Badges
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'Reading Streak', '3-day reading streak', '/badges/reading-streak.svg', 'streak', '{"streak": 3}'::jsonb, 'bronze', 50, 'streak', 30, true),
  (gen_random_uuid(), 'Consistent Reader', '7-day reading streak', '/badges/consistent-reader.svg', 'streak', '{"streak": 7}'::jsonb, 'silver', 100, 'streak', 31, true),
  (gen_random_uuid(), 'Month of Reading', '30-day reading streak', '/badges/month-of-reading.svg', 'streak', '{"streak": 30}'::jsonb, 'gold', 300, 'streak', 32, true),
  (gen_random_uuid(), 'Unstoppable', '60-day reading streak', '/badges/unstoppable.svg', 'streak', '{"streak": 60}'::jsonb, 'platinum', 600, 'streak', 33, true)
ON CONFLICT (name) DO NOTHING;

-- Special Badges
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'Early Bird', 'Read before 8 AM', '/badges/early-bird.svg', 'custom', '{"time": "08:00"}'::jsonb, 'special', 50, 'special', 40, true),
  (gen_random_uuid(), 'Weekend Warrior', 'Read on Saturday and Sunday', '/badges/weekend-warrior.svg', 'custom', '{"weekend": true}'::jsonb, 'special', 100, 'special', 41, true),
  (gen_random_uuid(), 'Speed Reader', 'Read 50 pages in one day', '/badges/speed-reader.svg', 'custom', '{"pages_per_day": 50}'::jsonb, 'special', 150, 'special', 42, true)
ON CONFLICT (name) DO NOTHING;

-- Checkpoint Badge
INSERT INTO badges (id, name, description, icon_url, badge_type, criteria, tier, xp_reward, category, display_order, is_active)
VALUES
  (gen_random_uuid(), 'Checkpoint Champion', 'Complete 10 checkpoint quizzes', '/badges/checkpoint-champion.svg', 'checkpoint', '{"checkpoints": 10}'::jsonb, 'gold', 300, 'quiz', 24, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE badges IS 'Achievement badges available in the system';
COMMENT ON COLUMN badges.tier IS 'Badge tier: bronze, silver, gold, platinum, special';
COMMENT ON COLUMN badges.category IS 'Badge category for organization: reading, milestone, quiz, streak, special';
COMMENT ON COLUMN badges.display_order IS 'Order to display badges in UI';
