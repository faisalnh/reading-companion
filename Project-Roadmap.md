Reading Buddy: Project Roadmap (Hybrid Stack)

1. Project Overview

Goal: A web-based e-library for K-12 students (Reading Buddy) with role-based access for Students, Teachers, Librarians, and Admins. The platform will be gamified and feature an AI-powered quiz generator.

Selected Architecture (Option 3 - Hybrid): This project uses a decoupled, hybrid-cloud architecture. We get the developer-friendly experience of a managed backend (Supabase) for our data and auth, combined with the low-cost, high-control benefits of self-hosted storage (MinIO) for our large files (PDFs and images).

2. Core Architecture

Here is the "full stack" information for all components.

Frontend:

Framework: Next.js 15+ (App Router)

Language: TypeScript

Styling: Tailwind CSS

UI: shadcn/ui (recommended for high-quality, accessible components)

Backend (Database & Auth):

Service: Supabase (Cloud-hosted recommended for simplicity)

SDK: supabase-js

Features: Replaces both Prisma (PostgreSQL database) and NextAuth (Authentication).

Backend (File Storage):

Service: MinIO (Self-hosted on Proxmox)

SDK: minio-js (for server-side admin tasks like generating upload URLs)

Features: Replaces S3/Cloudflare R2. Stores all large media (book PDFs, cover images, badge icons).

AI Integration:

Service: Google Gemini API

SDK: @google/generative-ai

Features: Called via secure Next.js Server Actions to generate quizzes based on book summaries.

Key Integrations:

react-pdf: For rendering the PDFs (from the MinIO URL) in the student's reader.

3. Development Phases

This is the logical order of development, from infrastructure to a functional app.

Phase 0: Infrastructure Setup (Self-Hosted)

This phase is your responsibility and must be completed before development begins.

MinIO Server:

On Proxmox, create a dedicated VM or LXC container for MinIO.

Install and configure MinIO.

Create a default bucket (e.g., reading-buddy).

Note the endpoint, port, accessKey, and secretKey.

Reverse Proxy (Critical):

Set up a reverse proxy (like Nginx Proxy Manager or Caddy) in a separate container.

Configure a subdomain (e.g., storage.yourschool.com) to point to your MinIO server.

Secure this subdomain with an SSL certificate (HTTPS). This is required for browsers to access the files.

Firewall & DNS:

Ensure your DNS is configured.

Ensure your firewall allows public access to the MinIO subdomain (ports 80/443).

Phase 1: Project Scaffolding & Core Backend

Supabase Project:

Create a new project in the Supabase dashboard.

Use the SQL Editor to run the schema (from ai-readme.md) to create your tables (profiles, books, classes, etc.).

Set up Role-Based Access (RLS) policies for security.

Next.js Project:

Initialize a new Next.js 15+ project (npx create-next-app@latest).

Install all dependencies: @supabase/supabase-js, minio, @google/generative-ai, react-pdf, tailwindcss, shadcn/ui.

Configuration:

Create .env.local and .env.example with all keys (Supabase, MinIO, Gemini).

Create lib/supabase.ts and lib/minio.ts to initialize and export the clients.

Phase 2: Authentication & User Roles

Auth UI: Build the Login, Sign Up, and Forgot Password pages.

Auth Logic: Use supabase-js client (supabase.auth.signInWithPassword, etc.) to handle authentication. Use Google OAuth provider from Supabase.

Profile Creation: Set up a Supabase SQL Trigger that automatically creates a profile (with a default role) when a new user signs up in the auth.users table.

Middleware: Create middleware.ts to protect routes (e.g., /dashboard/*). The middleware will check the user's session and role using the Supabase client.

Phase 3: Librarian & Book Management (Core Upload)

Librarian Dashboard: Create the main layout.

Book Upload Form: Build the "Add New Book" form (title, author, PDF file, cover image).

File Upload Logic (The Key Workflow):

Step 1: User submits the form.

Step 2: A Server Action is called.

Step 3: The Server Action uses the minio-js admin client to generate two presigned upload URLs (one for the PDF, one for the cover image).

Step 4: The Server Action returns these URLs to the client.

Step 5: The client uses fetch to PUT the files directly to the MinIO URLs.

Step 6: On successful upload, another Server Action is called.

Step 7: This final action saves the book's metadata (title, author) and the final public URLs (e.g., https://storage.yourschool.com/books/gatsby.pdf) to the Supabase books table.

Library UI: Build the library page where students can see all book covers.

Phase 4: Student Reader & Gamification

Student Dashboard: Show assigned books, achievements.

Book Reader:

Create a page app/(dashboard)/student/read/[bookId]/page.tsx.

Fetch the book record from Supabase to get the pdf_url.

Pass this URL to the react-pdf component.

Progress Tracking:

Use useState to track the currentPage.

Periodically save currentPage to a student_books table in Supabase.

Achievements:

Create logic (e.g., in a Server Action) that checks "Has this student finished 5 books?"

Award badges by creating a new entry in the student_achievements table.

Phase 5: AI Quiz Generation

UI: Add a "Generate AI Quiz" button to the Librarian/Teacher book management page.

Text Extraction (Option A - Simple): Add a summary field to the books table. The AI generates a quiz based only on the summary.

Text Extraction (Option B - Advanced): The Server Action fetches the PDF from MinIO, uses a library like pdf-parse to extract the text, and sends the text to Gemini.

Server Action:

The action calls the Gemini API with a prompt ("Generate a 5-question multiple-choice quiz...").

Specify JSON output format.

The action saves the returned JSON to the quizzes table in Supabase.

Quiz UI: Build a simple form for students to take the quiz and see their score.

Phase 6: Teacher & Admin Dashboards

Teacher Dashboard: Create views to see student progress (from student_books) and quiz scores (from quiz_attempts).

Classroom Management: Build UI to create a class and assign students to it.

Admin Dashboard: Build UI for managing user accounts and roles (updating the role field in the profiles table).

4. Key Success Criteria (MVP)

A Librarian can upload a PDF and cover image. The files are saved in MinIO, and the metadata is saved in Supabase.

A Student can log in, see the book, and read the PDF from MinIO in the react-pdf reader.

A Teacher can log in, see their students, and view their reading progress (currentPage).

An AI Quiz can be generated for a book and taken by a student.