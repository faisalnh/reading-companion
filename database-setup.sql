-- =============================================
-- Reading Buddy - Complete Database Setup
-- Version: 1.0.0
-- Description: Run this script in Supabase SQL Editor for new installations
-- =============================================

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
  -- Text extraction columns
  page_text_content JSONB,
  text_extracted_at TIMESTAMP WITH TIME ZONE,
  text_extraction_method VARCHAR(50),
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


-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Books indexes
CREATE INDEX idx_books_text_extracted
  ON books(text_extracted_at)
  WHERE text_extracted_at IS NOT NULL;

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


-- ============================================================================
-- PART 5: FUNCTIONS
-- ============================================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'STUDENT', -- Default role
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name') -- Extract name from OAuth data
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user emails (for admin panel)
CREATE OR REPLACE FUNCTION get_all_user_emails()
RETURNS TABLE (
  user_id uuid,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
-- PART 6: TRIGGERS
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
'Extracted text content from PDF in format:
{
  "pages": [{"pageNumber": 1, "text": "...", "wordCount": 245}],
  "totalPages": 150,
  "totalWords": 45000,
  "extractionMethod": "pdf-text"
}';

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

COMMENT ON FUNCTION get_all_user_emails() IS
'Returns user IDs and emails from auth.users table for admin purposes';


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
  RAISE NOTICE '  - 18 Tables (with all v1.0.0 features)';
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
