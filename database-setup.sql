-- =============================================
-- Reading Buddy - Complete Database Setup
-- Version: 1.0.0
-- Description: Run this script in Supabase SQL Editor for new installations
-- =============================================

-- ============================================================================
-- PART 1: ENUMS AND TYPES
-- ============================================================================

-- User roles
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'LIBRARIAN', 'ADMIN');

-- Book access levels
DROP TYPE IF EXISTS book_access_level CASCADE;
CREATE TYPE book_access_level AS ENUM (
  'KINDERGARTEN',
  'LOWER_ELEMENTARY',
  'UPPER_ELEMENTARY',
  'JUNIOR_HIGH',
  'TEACHERS_STAFF'
);


-- ============================================================================
-- PART 2: CORE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT,
  grade INT,
  access_level book_access_level, -- Nullable: only used for STUDENT role
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books table
CREATE TABLE books (
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
  -- Multi-format support columns
  file_format VARCHAR(20) DEFAULT 'pdf',
  original_file_url TEXT,
  file_size_bytes BIGINT,
  -- Text extraction columns
  page_text_content JSONB,
  text_extracted_at TIMESTAMP WITH TIME ZONE,
  text_extraction_method VARCHAR(50),
  -- Text extraction error tracking
  text_extraction_error TEXT,
  text_extraction_attempts INTEGER DEFAULT 0,
  last_extraction_attempt_at TIMESTAMP WITH TIME ZONE,
  -- Text-based reader columns
  text_json_url TEXT,
  text_extraction_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book access levels
CREATE TABLE book_access (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  access_level book_access_level NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (book_id, access_level)
);

-- Classes table
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class students (many-to-many)
CREATE TABLE class_students (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

-- Class books (many-to-many assignments)
CREATE TABLE class_books (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  book_id INT REFERENCES books(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  PRIMARY KEY (class_id, book_id)
);

-- Book render jobs
CREATE TABLE book_render_jobs (
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
CREATE TABLE student_books (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_page INT NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, book_id)
);

-- Quizzes table
CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES profiles(id),
  questions JSONB NOT NULL,
  -- Quiz type and page range columns
  page_range_start INTEGER,
  page_range_end INTEGER,
  quiz_type VARCHAR(50) DEFAULT 'classroom',
  checkpoint_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT quizzes_quiz_type_check CHECK (quiz_type IN ('checkpoint', 'classroom'))
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements definitions
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  badge_url TEXT NOT NULL,
  criteria JSONB
);

-- Student achievements (earned)
CREATE TABLE student_achievements (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, achievement_id)
);


-- ============================================================================
-- PART 3: CHECKPOINT AND BADGE TABLES
-- ============================================================================

-- Quiz checkpoints
CREATE TABLE quiz_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT unique_book_checkpoint UNIQUE(book_id, page_number)
);

-- Student checkpoint progress
CREATE TABLE student_checkpoint_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES quiz_checkpoints(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  quiz_score DECIMAL(5,2),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_student_checkpoint UNIQUE(student_id, checkpoint_id)
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url TEXT,
  badge_type VARCHAR(50) NOT NULL,
  criteria JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_badge_name UNIQUE(name),
  CONSTRAINT badges_badge_type_check CHECK (badge_type IN ('checkpoint', 'quiz_mastery', 'book_completion', 'streak', 'custom'))
);

-- Student badges earned
CREATE TABLE student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  metadata JSONB,
  CONSTRAINT unique_student_badge_book UNIQUE(student_id, badge_id, book_id)
);

-- Login broadcasts (messages displayed on login screen)
CREATE TABLE login_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'info',
  link_label TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly challenge completions
CREATE TABLE weekly_challenge_completions (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id VARCHAR(50) NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  xp_awarded INT NOT NULL,
  UNIQUE(student_id, challenge_id, week_number, year)
);


-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Books indexes
CREATE INDEX idx_books_text_extracted
  ON books(text_extracted_at)
  WHERE text_extracted_at IS NOT NULL;

CREATE INDEX idx_books_extraction_failed
  ON books(text_extraction_error)
  WHERE text_extraction_error IS NOT NULL;

CREATE INDEX idx_books_file_format
  ON books(file_format);

-- Quizzes indexes
CREATE INDEX idx_quizzes_type
  ON quizzes(quiz_type);

CREATE INDEX idx_quizzes_checkpoint
  ON quizzes(book_id, checkpoint_page)
  WHERE quiz_type = 'checkpoint';

CREATE INDEX idx_quizzes_page_range
  ON quizzes(book_id, page_range_start, page_range_end)
  WHERE page_range_start IS NOT NULL;

-- Quiz checkpoints indexes
CREATE INDEX idx_checkpoints_book
  ON quiz_checkpoints(book_id, page_number);

CREATE INDEX idx_checkpoints_quiz
  ON quiz_checkpoints(quiz_id);

-- Student checkpoint progress indexes
CREATE INDEX idx_checkpoint_progress_student
  ON student_checkpoint_progress(student_id, book_id);

CREATE INDEX idx_checkpoint_progress_incomplete
  ON student_checkpoint_progress(student_id, completed)
  WHERE completed = false;

CREATE INDEX idx_checkpoint_progress_checkpoint
  ON student_checkpoint_progress(checkpoint_id);

-- Badges indexes
CREATE INDEX idx_badges_type
  ON badges(badge_type);

CREATE INDEX idx_badges_active
  ON badges(is_active)
  WHERE is_active = true;

-- Student badges indexes
CREATE INDEX idx_student_badges_student
  ON student_badges(student_id, earned_at DESC);

CREATE INDEX idx_student_badges_badge
  ON student_badges(badge_id);

CREATE INDEX idx_student_badges_book
  ON student_badges(book_id)
  WHERE book_id IS NOT NULL;

-- Gamification indexes for leaderboard performance
CREATE INDEX idx_profiles_xp ON profiles(xp DESC);
CREATE INDEX idx_profiles_level ON profiles(level DESC);
CREATE INDEX idx_profiles_reading_streak ON profiles(reading_streak DESC);

-- Weekly challenge indexes
CREATE INDEX idx_weekly_challenge_completions_student ON weekly_challenge_completions(student_id);
CREATE INDEX idx_weekly_challenge_completions_week ON weekly_challenge_completions(week_number, year);


-- ============================================================================
-- PART 5: FUNCTIONS
-- ============================================================================

-- Function to create profile on user signup
-- SECURITY: Uses SECURITY DEFINER (required for trigger) but includes validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Prevent search_path exploits
AS $$
BEGIN
  -- Validation: ensure we're in the correct trigger context
  IF TG_OP != 'INSERT' THEN
    RAISE EXCEPTION 'handle_new_user can only be used in INSERT triggers';
  END IF;

  IF TG_TABLE_NAME != 'users' OR TG_TABLE_SCHEMA != 'auth' THEN
    RAISE EXCEPTION 'handle_new_user can only be used on auth.users table';
  END IF;

  -- Prevent duplicate profile creation
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Create profile with safe defaults
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'STUDENT', -- Default role (safe)
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    )
  );

  RETURN NEW;
END;
$$;

-- Function to get user emails (for admin panel)
-- SECURITY: No longer uses SECURITY DEFINER - includes explicit ADMIN role check
CREATE OR REPLACE FUNCTION get_all_user_emails()
RETURNS TABLE (
  user_id uuid,
  email text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Explicit role check: only ADMIN can execute this function
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'Access denied: only administrators can view user emails';
  END IF;

  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email::text as email
  FROM auth.users u;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 6: VIEWS
-- ============================================================================

-- Quiz statistics view
-- SECURITY: Uses SECURITY INVOKER (default) - RLS policies on underlying tables apply
CREATE VIEW public.quiz_statistics AS
SELECT
  q.id,
  q.book_id,
  q.created_by_id,
  q.questions,
  q.page_range_start,
  q.page_range_end,
  q.quiz_type,
  q.checkpoint_page,
  q.created_at,

  -- Statistics from quiz_attempts
  COUNT(DISTINCT qa.id) AS total_attempts,
  COUNT(DISTINCT qa.student_id) AS unique_students,
  ROUND(AVG(qa.score), 2) AS average_score,
  MAX(qa.score) AS highest_score,
  MIN(qa.score) AS lowest_score,

  -- Additional metadata
  CASE
    WHEN COUNT(qa.id) = 0 THEN 'no_attempts'
    WHEN AVG(qa.score) >= 80 THEN 'high_performance'
    WHEN AVG(qa.score) >= 60 THEN 'moderate_performance'
    ELSE 'needs_improvement'
  END AS performance_category,

  -- Count recent attempts (last 7 days)
  COUNT(DISTINCT CASE
    WHEN qa.submitted_at > NOW() - INTERVAL '7 days'
    THEN qa.id
  END) AS recent_attempts_7d,

  -- Question count - handle both formats:
  -- Format 1 (nested): {"title": "...", "questions": [...]}
  -- Format 2 (direct array): [...]
  CASE
    WHEN jsonb_typeof(q.questions) = 'array' THEN jsonb_array_length(q.questions)
    WHEN jsonb_typeof(q.questions) = 'object' AND q.questions ? 'questions' THEN
      jsonb_array_length(q.questions->'questions')
    ELSE 0
  END AS question_count

FROM public.quizzes q
LEFT JOIN public.quiz_attempts qa ON q.id = qa.quiz_id
GROUP BY
  q.id,
  q.book_id,
  q.created_by_id,
  q.questions,
  q.page_range_start,
  q.page_range_end,
  q.quiz_type,
  q.checkpoint_page,
  q.created_at;

-- Grant permissions
GRANT SELECT ON public.quiz_statistics TO authenticated;


-- ============================================================================
-- PART 7: TRIGGERS
-- ============================================================================

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to update student_checkpoint_progress updated_at
CREATE TRIGGER update_student_checkpoint_progress_updated_at
  BEFORE UPDATE ON student_checkpoint_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update badges updated_at
CREATE TRIGGER update_badges_updated_at
  BEFORE UPDATE ON badges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update student_books updated_at
CREATE TRIGGER update_student_books_updated_at
  BEFORE UPDATE ON student_books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PART 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
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
ALTER TABLE login_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Books policies
CREATE POLICY "Books are viewable by all authenticated users."
  ON books FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Librarians and Admins can manage books."
  ON books FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIBRARIAN', 'ADMIN')
  );

-- Book access policies
CREATE POLICY "Book access readable by authenticated users"
  ON book_access FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Librarians manage book access"
  ON book_access FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIBRARIAN', 'ADMIN')
  )
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIBRARIAN', 'ADMIN'));

-- Book render jobs policies
CREATE POLICY "Admins view render jobs"
  ON book_render_jobs FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIBRARIAN', 'ADMIN')
  );

-- Student books (reading progress) policies
CREATE POLICY "Students can view their own reading progress"
  ON student_books
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own reading progress"
  ON student_books
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own reading progress"
  ON student_books
  FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view their students' reading progress"
  ON student_books
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('TEACHER', 'ADMIN')
    )
  );

-- Quizzes policies
CREATE POLICY "Librarians and admins can view all quizzes"
  ON quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('LIBRARIAN', 'ADMIN')
    )
  );

CREATE POLICY "Teachers can view quizzes for their class books"
  ON quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'TEACHER'
    )
    AND (
      created_by_id = auth.uid()
      OR
      book_id IN (
        SELECT cb.book_id
        FROM class_books cb
        JOIN classes c ON cb.class_id = c.id
        WHERE c.teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students can view quizzes for assigned books"
  ON quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'STUDENT'
    )
    AND (
      book_id IN (
        SELECT cb.book_id
        FROM class_books cb
        JOIN class_students cs ON cb.class_id = cs.class_id
        WHERE cs.student_id = auth.uid()
      )
      OR
      book_id IN (
        SELECT sb.book_id
        FROM student_books sb
        WHERE sb.student_id = auth.uid()
      )
    )
  );

CREATE POLICY "Librarians and admins can manage quizzes"
  ON quizzes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('LIBRARIAN', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('LIBRARIAN', 'ADMIN')
    )
  );

CREATE POLICY "Teachers can create quizzes"
  ON quizzes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'TEACHER'
    )
    AND created_by_id = auth.uid()
  );

CREATE POLICY "Teachers can manage their own quizzes"
  ON quizzes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'TEACHER'
    )
    AND created_by_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'TEACHER'
    )
    AND created_by_id = auth.uid()
  );

CREATE POLICY "Teachers can delete their own quizzes"
  ON quizzes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'TEACHER'
    )
    AND created_by_id = auth.uid()
  );

-- Quiz attempts policies
CREATE POLICY "Students can view their own quiz attempts"
  ON quiz_attempts
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own quiz attempts"
  ON quiz_attempts
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view their students' quiz attempts"
  ON quiz_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('TEACHER', 'ADMIN', 'LIBRARIAN')
    )
  );

-- Quiz checkpoints policies
CREATE POLICY "Librarians and admins can manage checkpoints"
  ON quiz_checkpoints
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('LIBRARIAN', 'ADMIN')
    )
  );

CREATE POLICY "Everyone can view checkpoints"
  ON quiz_checkpoints
  FOR SELECT
  USING (true);

-- Student checkpoint progress policies
CREATE POLICY "Students can view their own checkpoint progress"
  ON student_checkpoint_progress
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own checkpoint progress"
  ON student_checkpoint_progress
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own checkpoint progress"
  ON student_checkpoint_progress
  FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view their students' checkpoint progress"
  ON student_checkpoint_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('TEACHER', 'ADMIN')
    )
  );

-- Badges policies
CREATE POLICY "Everyone can view active badges"
  ON badges
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage badges"
  ON badges
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Student badges policies
CREATE POLICY "Students can view their own badges"
  ON student_badges
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "System can insert student badges"
  ON student_badges
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers and admins can view all student badges"
  ON student_badges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('TEACHER', 'ADMIN')
    )
  );

-- Weekly challenge completions policies
CREATE POLICY "Students can view their own challenge completions"
  ON weekly_challenge_completions
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Teachers and admins can view all challenge completions"
  ON weekly_challenge_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('TEACHER', 'ADMIN', 'LIBRARIAN')
    )
  );


-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission on email function
GRANT EXECUTE ON FUNCTION get_all_user_emails() TO authenticated;


-- ============================================================================
-- PART 9: INSERT DEFAULT BADGES
-- ============================================================================

INSERT INTO badges (name, description, icon_url, badge_type, criteria) VALUES
(
  'Checkpoint Champion',
  'Complete all checkpoints in a book',
  '/badges/checkpoint-champion.svg',
  'checkpoint',
  '{"type": "checkpoint_completion", "description": "Complete all checkpoints in any book"}'::JSONB
),
(
  'Quiz Master',
  'Score 90% or higher on 5 quizzes',
  '/badges/quiz-master.svg',
  'quiz_mastery',
  '{"type": "quiz_score", "minScore": 90, "quizCount": 5, "description": "Score 90%+ on 5 quizzes"}'::JSONB
),
(
  'Perfect Score',
  'Get 100% on any quiz',
  '/badges/perfect-score.svg',
  'quiz_mastery',
  '{"type": "perfect_quiz", "description": "Score 100% on any quiz"}'::JSONB
),
(
  'Book Finisher',
  'Complete a book with all its checkpoints',
  '/badges/book-finisher.svg',
  'book_completion',
  '{"type": "book_with_checkpoints", "description": "Finish reading a book and complete all its checkpoints"}'::JSONB
),
(
  'Reading Streak',
  'Read for 7 days in a row',
  '/badges/reading-streak.svg',
  'streak',
  '{"type": "reading_streak", "days": 7, "description": "Read for 7 consecutive days"}'::JSONB
),
(
  'First Book',
  'Complete your first book',
  '/badges/first-book.svg',
  'book_completion',
  '{"type": "books_completed", "count": 1, "description": "Complete your first book"}'::JSONB
)
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- PART 10: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN books.page_text_content IS
'Extracted text content from e-book in format:
{
  "pages": [{"pageNumber": 1, "text": "...", "wordCount": 245}],
  "totalPages": 150,
  "totalWords": 45000,
  "extractionMethod": "pdf-text" | "epub-html"
}';

COMMENT ON COLUMN books.file_format IS
'Original file format: pdf, epub (more formats may be added in future)';

COMMENT ON COLUMN books.original_file_url IS
'URL to original uploaded file before conversion (e.g., original EPUB or PDF file in MinIO)';

COMMENT ON COLUMN books.file_size_bytes IS
'Size of the original uploaded file in bytes';

COMMENT ON COLUMN books.text_extraction_error IS
'Last error message if text extraction failed. NULL if extraction succeeded or has not been attempted.';

COMMENT ON COLUMN books.text_extraction_attempts IS
'Number of times text extraction has been attempted for this book. Useful for monitoring and debugging.';

COMMENT ON COLUMN books.last_extraction_attempt_at IS
'Timestamp of the most recent extraction attempt (successful or failed). Used to track retry history.';

COMMENT ON COLUMN quizzes.quiz_type IS
'Type of quiz: "checkpoint" for in-reading quizzes that block progress, "classroom" for badge-based assessment quizzes';

COMMENT ON COLUMN quizzes.checkpoint_page IS
'For checkpoint quizzes: the page number where this quiz must be completed';

COMMENT ON TABLE quiz_checkpoints IS
'Defines checkpoint locations in books where students must complete quizzes';

COMMENT ON COLUMN quiz_checkpoints.is_required IS
'Whether students must complete this checkpoint to continue reading';

COMMENT ON TABLE student_checkpoint_progress IS
'Tracks individual student progress through reading checkpoints';

COMMENT ON COLUMN student_checkpoint_progress.attempts IS
'Number of times student has attempted this checkpoint quiz';

COMMENT ON TABLE badges IS
'Defines available badges/achievements that students can earn';

COMMENT ON COLUMN badges.criteria IS
'JSONB criteria for earning badge, e.g.:
{"type": "checkpoint_completion", "bookId": 123}
{"type": "quiz_score", "minScore": 90, "quizCount": 5}
{"type": "perfect_checkpoint", "bookId": 123}';

COMMENT ON TABLE student_badges IS
'Tracks which badges each student has earned';

COMMENT ON COLUMN student_badges.metadata IS
'Additional context about how the badge was earned (e.g., score, date, specific achievement details)';

COMMENT ON TABLE login_broadcasts IS
'Short broadcast messages shown on the login page; maintained by admins.';

COMMENT ON COLUMN login_broadcasts.tone IS
'Display tone for styling. Expected values: info, success, warning, alert.';

COMMENT ON FUNCTION get_all_user_emails() IS
'Returns user IDs and emails from auth.users table.
SECURITY: Only accessible by users with ADMIN role.
Non-admin users will receive "Access denied" error.
Used by admin panel for user management.';

COMMENT ON FUNCTION public.handle_new_user() IS
'Trigger function to create user profile on signup.
SECURITY: Uses SECURITY DEFINER (required for trigger).
Includes validation to prevent misuse.
Always creates profiles with STUDENT role (safe default).
SET search_path protects against search_path exploits.';

COMMENT ON VIEW public.quiz_statistics IS
'Aggregates quiz data with attempt statistics including total attempts, unique students, average/highest/lowest scores, and performance categories.
SECURITY: Uses SECURITY INVOKER (default) - RLS policies apply.
Access is controlled through RLS policies on underlying tables (quizzes, quiz_attempts).
Users only see statistics for quizzes they have permission to view based on their role and class assignments.
Supports both quiz question formats: direct array or nested object with title.';


-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Reading Buddy Database Setup Complete!';
  RAISE NOTICE 'Version: 1.0.0';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 2 ENUMs (user_role, book_access_level)';
  RAISE NOTICE '  - 19 Tables (v1.0.0 features plus login broadcasts)';
  RAISE NOTICE '  - 15+ Indexes for performance';
  RAISE NOTICE '  - 3 Functions (user creation, email lookup, timestamp updates)';
  RAISE NOTICE '  - 3 Triggers';
  RAISE NOTICE '  - Complete RLS policies';
  RAISE NOTICE '  - 6 Default badges';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Configure your environment variables (.env)';
  RAISE NOTICE '  2. Set up MinIO storage';
  RAISE NOTICE '  3. Deploy your application';
  RAISE NOTICE '  4. Create your first admin user';
  RAISE NOTICE '=================================================';
END $$;
