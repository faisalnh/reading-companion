# AI Coding Reference - Reading Buddy

**Last Updated:** 2025-11-04

## Project Overview

Reading Buddy is a web-based e-library application for K-12 educational environments. The platform supports role-based access for Students, Teachers, Librarians, and Admin/Principals. Students read ebooks through a gamified interface, earning badges and achievements. Teachers and Librarians manage content and track student progress.

## Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js v5 with Google OAuth
- **Styling:** Tailwind CSS
- **PDF Rendering:** react-pdf
- **AI Integration:** Google Gemini API (AI Studio)
- **Deployment:** Docker-based

## User Roles & Permissions

### Student
- Browse assigned library
- Read books (PDF reader with page memory)
- Take AI-generated quizzes
- View personal achievements and badges
- View own progress

### Teacher
- Manage one or more classrooms
- View student progress (books read, quiz scores, time spent)
- Assign books from global library to students
- Curate book lists for classes

### Librarian
- Manage school's master digital library
- Upload and categorize new books
- Organize school-wide reading challenges

### Admin/Principal
- Manage user accounts (create Teacher/Librarian accounts)
- View school-wide analytics dashboards
- Access all system functionalities

## Current Project Status

### ✅ Completed
- npm project initialized with proper scripts
- Core dependencies installed (Next.js 16, React 19, NextAuth v4, Prisma 6, react-pdf, Google Generative AI)
- Dev dependencies installed (TypeScript 5.9, ESLint, Tailwind CSS 4.1, PostCSS, tsx)
- TypeScript configuration (strict mode enabled)
- Next.js configuration (App Router, server actions, image optimization)
- Tailwind CSS configuration with custom color palette (primary, secondary, accent, success)
- PostCSS and ESLint configuration
- Complete project folder structure created
- Root layout and landing page with colorful gradient design
- Global CSS with custom scrollbar styling
- .gitignore configured for Next.js, Prisma, and uploads
- Prisma schema with all models (User, Student, Teacher, Librarian, Admin, Book, Quiz, Achievement, Class)
- Prisma client utility (lib/db.ts)
- Environment variables template (.env.example)

### 🚧 In Progress
- NextAuth.js configuration with Google OAuth

### 📋 Pending
- Dockerfile for deployment
- Database seed script with sample data
- Role-based layouts and navigation
- Auth pages (login/signup)
- Dashboard pages for each role

## Database Schema (Implemented)

**Full schema available in:** `prisma/schema.prisma`

### Core Models:

**Authentication (NextAuth):**
- User - Main user model with email, name, image, role (enum: STUDENT, TEACHER, LIBRARIAN, ADMIN)
- Account - OAuth accounts
- Session - User sessions
- VerificationToken - Email verification

**Role-Specific Profiles:**
- Student - userId, grade, points (gamification)
- Teacher - userId, schoolId
- Librarian - userId, schoolId
- Admin - userId, schoolId

**Books & Reading:**
- Book - title, author, publisher, year, isbn, description, category, grade, pdfUrl, coverUrl, pageCount
- StudentBook - Reading progress tracking (studentId, bookId, currentPage, completed, startedAt, completedAt)

**Quizzes:**
- Quiz - AI-generated or manual quizzes (bookId, questions as JSON, generatedBy)
- QuizAttempt - Student quiz submissions (studentId, quizId, answers as JSON, score)

**Gamification:**
- Achievement - Badge definitions (name, description, badgeUrl, criteria as JSON, points)
- StudentAchievement - Earned badges (studentId, achievementId, earnedAt)

**Classroom Management:**
- Class - Teacher's classes (teacherId, name, grade)
- ClassStudent - Many-to-many (class ↔ students)
- ClassBook - Books assigned to classes (classId, bookId, assignedAt, dueDate)

### Key Features:
- **Indexes** on frequently queried fields (email, role, category, etc.)
- **Cascade deletes** for data integrity
- **JSON fields** for flexible quiz questions and achievement criteria
- **Unique constraints** to prevent duplicates
- **Timestamps** on all models for audit trails

## Project Structure (To Be Created)

```
/reading-buddy
├── app/
│   ├── (auth)/              # Auth pages (login, signup)
│   ├── (dashboard)/         # Protected routes
│   │   ├── student/         # Student dashboard & reader
│   │   ├── teacher/         # Teacher dashboard & classroom
│   │   ├── librarian/       # Library management
│   │   └── admin/           # Admin panel
│   ├── api/                 # API routes
│   │   ├── auth/           # NextAuth handlers
│   │   └── ...             # Other API endpoints
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── reader/              # PDF reader components
│   ├── dashboard/           # Dashboard widgets
│   └── achievements/        # Badge/achievement components
├── lib/
│   ├── auth.ts             # Auth configuration
│   ├── db.ts               # Prisma client
│   └── utils.ts            # Helper functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed data
├── public/
│   ├── books/              # PDF files
│   ├── covers/             # Book cover images
│   └── badges/             # Achievement badges
├── types/                  # TypeScript type definitions
└── .env.example            # Environment variables template
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/reading_buddy"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI Integration
GEMINI_API_KEY="your-gemini-api-key"
```

## Design Philosophy

- **Style:** Fun, funky, colorful, kid-friendly
- **Color Palette:** Vibrant and playful (to be defined)
- **Typography:** Bold and legible
- **Interactions:** Smooth animations and delightful transitions
- **Target Audience:** K-12 students (make it feel like a game, not a utility)

## MVP Success Criteria

1. Teacher can log in, view students, and see reading progress
2. Student can log in, select assigned book, and read in web reader
3. Student earns at least one achievement and views it on profile
4. Student can take AI-generated quiz after finishing a book

## Development Conventions

### Code Style
- Use TypeScript strict mode
- Follow Next.js 15 App Router conventions
- Use server components by default, client components only when needed
- Implement server actions for mutations
- Use Prisma for all database operations

### File Naming
- Components: PascalCase (e.g., `StudentDashboard.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Routes: kebab-case folders (e.g., `student-profile/`)

### Component Structure
```typescript
// Server Component (default)
export default async function ComponentName() {
  const data = await fetchData();
  return <div>...</div>;
}

// Client Component (when needed)
'use client';
export default function ComponentName() {
  return <div>...</div>;
}
```

## Recent Updates

### 2025-11-04 - Initial Project Scaffolding (Complete)

**Configuration Files Created:**
- `tsconfig.json` - TypeScript strict mode, path aliases (@/*)
- `next.config.js` - Server actions with 10mb body limit, Google OAuth image domain
- `tailwind.config.ts` - Custom color palette (primary/secondary/accent/success with 50-900 shades)
- `postcss.config.js` - Tailwind and Autoprefixer plugins
- `.eslintrc.json` - Next.js core web vitals
- `.gitignore` - Comprehensive ignore rules for Next.js, Prisma, uploads
- `package.json` - Updated with dev/build/start/lint/db scripts

**Dependencies Installed:**
- Production: next@16.0.1, react@19.2.0, next-auth@4.24.13, @prisma/client@6.18.0, react-pdf@10.2.0, @google/generative-ai@0.24.1
- Development: typescript@5.9.3, tailwindcss@4.1.16, prisma@6.18.0, tsx@4.20.6, eslint@9.39.1

**Folder Structure Created:**
```
app/
├── api/auth/              # NextAuth API routes
├── (auth)/                # Auth route group
├── (dashboard)/           # Dashboard route group
│   ├── student/
│   ├── teacher/
│   ├── librarian/
│   └── admin/
components/
├── ui/                    # Shared UI components
├── reader/                # PDF reader components
├── dashboard/             # Dashboard widgets
└── achievements/          # Achievement/badge components
lib/                       # Utility functions and configs
prisma/                    # Database schema and seeds
public/
├── books/                 # PDF storage
├── covers/                # Book cover images
└── badges/                # Achievement badges
types/                     # TypeScript definitions
```

**Files Created:**
- `app/globals.css` - Tailwind directives, custom colorful scrollbar, CSS variables
- `app/layout.tsx` - Root layout with metadata
- `app/page.tsx` - Landing page with gradient background and "Get Started" CTA
- `.gitkeep` files in public/covers and public/badges

**Design Implementation:**
- Vibrant gradient background (primary → secondary → accent)
- Animated bounce effect on title
- Custom gradient scrollbar (red to blue)
- Fun, playful color scheme targeting K-12 audience

### 2025-11-04 - Database Schema & Environment Setup (Complete)

**Prisma Schema Created:**
- 16 models total covering all MVP requirements
- User authentication with NextAuth.js models (User, Account, Session, VerificationToken)
- Role-based profiles (Student, Teacher, Librarian, Admin) with one-to-one relationships
- Book management with metadata (title, author, publisher, year, isbn, category, grade)
- Reading progress tracking (StudentBook with currentPage, completed status, timestamps)
- Quiz system with JSON questions and student attempts
- Gamification with achievements and earned badges
- Classroom management (Class, ClassStudent, ClassBook)
- Proper indexes on all frequently queried fields
- Cascade delete rules for data integrity
- Unique constraints to prevent duplicates

**Database Client:**
- `lib/db.ts` - Prisma client singleton with development hot-reload protection

**Environment Variables:**
- `.env.example` - Complete template with DATABASE_URL, NextAuth config, Google OAuth, Gemini API
- Includes helpful comments and links for obtaining credentials

**Schema Highlights:**
- UserRole enum (STUDENT, TEACHER, LIBRARIAN, ADMIN)
- JSON fields for flexible quiz questions and achievement criteria
- Many-to-many relationships through join tables
- Comprehensive indexes for performance
- All timestamps for audit trails

## Known Issues & TODOs

- [x] ~~Initialize Tailwind CSS config~~
- [x] ~~Create Next.js folder structure~~
- [x] ~~Configure TypeScript and Next.js~~
- [ ] Define complete Prisma schema with all models
- [ ] Set up NextAuth with Google OAuth provider
- [ ] Create .env.example template
- [ ] Create Dockerfile and docker-compose.yml for deployment
- [ ] Implement database seed script with sample books and users
- [ ] Create role-based middleware for route protection
- [ ] Build authentication UI (login page)
- [ ] Implement dashboard layouts for each role

## Quick Start Commands

```bash
# Install dependencies
npm install

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed

# Run development server
npm run dev

# Build for production
npm run build
```

## API Endpoints (To Be Implemented)

### Authentication
- `POST /api/auth/signin` - Sign in with Google
- `GET /api/auth/session` - Get current session

### Books
- `GET /api/books` - List books (filtered by role)
- `GET /api/books/[id]` - Get book details
- `POST /api/books` - Upload new book (Librarian/Admin only)

### Student Progress
- `GET /api/students/[id]/progress` - Get student reading progress
- `PATCH /api/students/[id]/books/[bookId]` - Update reading progress
- `POST /api/students/[id]/achievements` - Award achievement

### Quizzes
- `POST /api/quizzes/generate` - Generate AI quiz for a book
- `POST /api/quizzes/[id]/submit` - Submit quiz answers
- `GET /api/quizzes/[id]/results` - Get quiz results

### Teacher/Classroom
- `GET /api/teachers/[id]/students` - Get teacher's students
- `POST /api/classes` - Create new class
- `POST /api/classes/[id]/assign` - Assign book to class

## Notes for AI Agents

1. **Always check this file first** before making changes to understand current state
2. **Update this file** when completing major features or making architectural changes
3. **Prisma schema is the source of truth** for data models - check it before creating queries
4. **Role-based access control** is critical - always verify permissions before data access
5. **Keep the design fun and colorful** - this is for kids!
6. Sample PDFs with metadata are available - ask user for location when implementing book upload
7. User has Google OAuth credentials ready for NextAuth setup
8. Deployment target is Docker - ensure Docker compatibility
