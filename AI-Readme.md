AI Agent Development Guide: Reading Buddy

Project: Reading Buddy (K-12 e-Library)
Current Time: Friday, November 7, 2025
Mandate: You are an AI coding agent. Your task is to build the "Reading Buddy" application based on the architecture defined below. This file is your primary source of truth. You must follow its rules explicitly.

1. Core Architecture & Mandates

This is a hybrid-backend project. You MUST use the correct SDK for each task.

MANDATE 1: Authentication (Supabase)

You MUST use the supabase-js library for all authentication.

This includes login, logout, sign up, session management, and OAuth (Google).

You WILL NOT use NextAuth.js.

You WILL NOT use Prisma.

MANDATE 2: Database (Supabase)

You MUST use the supabase-js client for all database operations (CRUD).

All data tables (e.g., books, profiles) are in the Supabase PostgreSQL database.

You WILL NOT use Prisma.

MANDATE 3: File Storage (MinIO)

You MUST use minio-js (admin client) for storage-related admin tasks (e.g., generating presigned URLs).

All large files (PDFs, images) are stored in a self-hosted MinIO bucket.

The File Upload Workflow is NON-NEGOTIABLE:

Client: Requests a secure upload URL from the server.

Server (Server Action): Uses minio.presignedPutObject() to generate a temporary write-only URL. Returns this URL to the client.

Client: Uses fetch with the PUT method to upload the file directly to MinIO.

Server (Server Action): After the client confirms the upload, a separate action saves the book's metadata (and its final public URL) to the Supabase database.

You WILL NOT use Supabase Storage for this project.

MANDATE 4: AI (Google Gemini)

You MUST call the Gemini API (@google/generative-ai) only from secure Next.js Server Actions.

The GEMINI_API_KEY MUST NOT be exposed to the client.

MANDATE 5: Framework & Styling

Framework: Next.js 15+ (App Router).

Language: TypeScript.

Styling: Tailwind CSS (utility classes only).

Components: shadcn/ui.

State Management: Use React useState, useReducer, useContext, or zustand.

2. Environment Variables

You must assume these variables are available in .env.local. Create .env.example with this content.

# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL="https"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Supabase (Private - for admin tasks if needed)
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# MinIO (Self-Hosted)
MINIO_ENDPOINT="storage.yourschool.com" # The public-facing reverse proxy URL
MINIO_PORT=443 # 9000 if no reverse proxy
MINIO_USE_SSL=true # true if using HTTPS
MINIO_ACCESS_KEY="your-minio-access-key"
MINIO_SECRET_KEY="your-minio-secret-key"
MINIO_BUCKET_NAME="reading-buddy"

# Google AI
GEMINI_API_KEY="your-gemini-api-key"


3. Database Schema (Supabase)

This schema must be run in the Supabase SQL Editor by the user. You will write your code against this schema.

-- 1. User Roles Enum
CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'LIBRARIAN', 'ADMIN');

-- 2. Profiles Table
-- Stores public data & role for each user in auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT,
  grade INT,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Books Table
-- Stores metadata for books stored in MinIO
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  category TEXT,
  grade_level INT,
  page_count INT,
  -- These are the *public, read-only* URLs from MinIO
  pdf_url TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Classes Table
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Class <-> Student (Many-to-Many)
CREATE TABLE class_students (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

-- 6. Class <-> Book (Many-to-Many, "Assignments")
CREATE TABLE class_books (
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  book_id INT REFERENCES books(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  PRIMARY KEY (class_id, book_id)
);

-- 7. Student Reading Progress
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

-- 8. Quizzes Table
CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES profiles(id),
  questions JSONB NOT NULL, -- Stores the JSON from Gemini
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Quiz Attempts
CREATE TABLE quiz_attempts (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INT NOT NULL, -- e.g., 80
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Achievements (Definitions)
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  badge_url TEXT NOT NULL, -- This URL will point to MinIO
  criteria JSONB -- e.g., {"type": "books_read", "count": 5}
);

-- 11. Student <-> Achievement (Earned)
CREATE TABLE student_achievements (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, achievement_id)
);


-- Function to create a profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'STUDENT'); -- Default role
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS (Row Level Security) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (Examples - User must add more)
CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Books are viewable by all authenticated users."
  ON books FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Librarians and Admins can manage books."
  ON books FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIBRARIAN', 'ADMIN')
  );

-- Add more RLS policies for other tables as needed...


4. Development Checklist

This checklist tracks your progress. Update it as you complete tasks.

Phase 0: Infrastructure (User Task)

[x] User has set up MinIO on Proxmox.

[x] User has set up a reverse proxy with HTTPS for MinIO.

[x] User has set up the Supabase project.

[x] User has run the SQL schema above.

Phase 1: Project Scaffolding

[x] Create Next.js project.

[x] Install dependencies: @supabase/supabase-js, minio, @google/generative-ai, react-pdf, tailwindcss, shadcn-ui.

[x] Create .env.example.

[x] Create lib/supabase/client.ts (Browser client).

[x] Create lib/supabase/server.ts (Server client).

[x] Create lib/minio.ts (Admin client).

Phase 2: Authentication & User Roles

[x] Create app/(auth)/login/page.tsx.

[x] Create app/(auth)/signup/page.tsx.

[x] Implement password and Google OAuth logic.

[x] Create middleware.ts for route protection (e.g., /dashboard/*).

Phase 3: Librarian & Book Management

[x] Create app/(dashboard)/librarian/page.tsx.

[x] Create component for book upload form.

[x] Create Server Action to generate MinIO presigned URL.

[x] Implement client-side fetch (PUT) to upload to MinIO.

[x] Create Server Action to save book metadata to Supabase.

[x] Create app/(dashboard)/library/page.tsx (Book gallery).

Phase 4: Student Reader & Gamification

[x] Create app/(dashboard)/student/page.tsx.

[x] Create app/(dashboard)/student/read/[bookId]/page.tsx.

[x] Implement react-pdf component to load pdf_url from Supabase.

[x] Create Server Action to save currentPage to student_books table.

[x] Create achievements logic.

Phase 5: AI Quiz Generation

[x] Create "Generate Quiz" button for Librarians.

[x] Create Server Action to call Gemini API.

[x] Implement logic to save JSON quiz to quizzes table.

[x] Create app/(dashboard)/student/quiz/[quizId]/page.tsx to take quiz.

Phase 6: Teacher & Admin Dashboards

[x] Create app/(dashboard)/teacher/page.tsx.

[x] Implement views for student progress.

[x] Create app/(dashboard)/admin/page.tsx.

[x] Implement user role management.
