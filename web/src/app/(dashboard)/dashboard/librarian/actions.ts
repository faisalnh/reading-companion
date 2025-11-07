'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getMinioBucketName, getMinioClient } from '@/lib/minio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const checkCurrentUserRole = async () => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not signed in' };
  }

  // Query without .single() first to check for duplicates
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id);

  const hasDuplicates = profiles && profiles.length > 1;
  const profile = profiles?.[0]; // Take the first one if multiple exist

  return {
    userId: user.id,
    email: user.email,
    profile,
    profileError: profileError ? profileError.message : null,
    hasDuplicates,
    profileCount: profiles?.length || 0,
  };
};

const getPublicBaseUrl = () => {
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT;
  const useSSL = process.env.MINIO_USE_SSL !== 'false';

  if (!endpoint) {
    throw new Error('MINIO_ENDPOINT is not configured.');
  }

  const protocol = useSSL ? 'https' : 'http';
  const defaultPort = useSSL ? '443' : '80';
  const portSegment = port && port !== defaultPort ? `:${port}` : '';

  return `${protocol}://${endpoint}${portSegment}`;
};

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
};

export const generatePresignedUploadUrls = async (input: {
  pdfFilename: string;
  coverFilename: string;
}) => {
  const minioClient = getMinioClient();
  const bucketName = getMinioBucketName();
  const publicBaseUrl = getPublicBaseUrl();

  const sanitizedPdfFilename = sanitizeFilename(input.pdfFilename);
  const sanitizedCoverFilename = sanitizeFilename(input.coverFilename);

  const pdfObjectKey = `books/${randomUUID()}-${sanitizedPdfFilename}`;
  const coverObjectKey = `covers/${randomUUID()}-${sanitizedCoverFilename}`;

  const [pdfUploadUrl, coverUploadUrl] = await Promise.all([
    minioClient.presignedPutObject(bucketName, pdfObjectKey, 60 * 5),
    minioClient.presignedPutObject(bucketName, coverObjectKey, 60 * 5),
  ]);

  return {
    pdfUploadUrl,
    coverUploadUrl,
    pdfObjectKey,
    coverObjectKey,
    pdfPublicUrl: `${publicBaseUrl}/${bucketName}/${pdfObjectKey}`,
    coverPublicUrl: `${publicBaseUrl}/${bucketName}/${coverObjectKey}`,
  };
};

export const saveBookMetadata = async (input: {
  title: string;
  author: string;
  description?: string;
  category?: string;
  gradeLevel?: number;
  pageCount?: number;
  pdfUrl: string;
  coverUrl: string;
}) => {
  const supabase = await createSupabaseServerClient();

  // Debug: Check current user and their role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to upload books.');
  }

  // Check user's profile and role (handle duplicates by taking first result)
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id);

  console.log('Current user:', user.email);
  console.log('Profiles found:', profiles?.length);
  console.log('Profile data:', profiles);
  console.log('Profile error:', profileError);

  if (profileError) {
    throw new Error(`Profile query failed: ${profileError.message}. Please contact admin.`);
  }

  if (!profiles || profiles.length === 0) {
    throw new Error('No profile found for your account. Please contact admin to set up your profile.');
  }

  if (profiles.length > 1) {
    console.warn(`Warning: User ${user.id} has ${profiles.length} duplicate profiles. Using the first one.`);
  }

  const profile = profiles[0];

  if (!profile || !['LIBRARIAN', 'ADMIN'].includes(profile.role)) {
    throw new Error(
      `Insufficient permissions. Your current role is: ${profile?.role || 'unknown'}. Only LIBRARIAN or ADMIN users can upload books.`
    );
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { error } = await supabaseAdmin.from('books').insert({
    title: input.title,
    author: input.author,
    description: input.description,
    category: input.category,
    grade_level: input.gradeLevel,
    page_count: input.pageCount,
    pdf_url: input.pdfUrl,
    cover_url: input.coverUrl,
  });

  if (error) {
    console.error('Book insert error:', error);
    throw error;
  }

  revalidatePath('/dashboard/library');
};

export const generateQuizForBook = async (input: { bookId: number }) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to generate a quiz.');
  }

  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, title, description')
    .eq('id', input.bookId)
    .single();

  if (bookError || !book) {
    throw new Error('Book not found.');
  }

  if (!book.description) {
    throw new Error('Add a summary/description before generating a quiz.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  });

  const prompt = `
    You are an assistant who writes engaging multiple-choice quizzes for students aged 10-16.
    Based on the following book summary, write 5 multiple-choice questions.
    Each question must contain 4 answer options and a correct answer index.

    Return JSON with this shape:
    {
      "title": "${book.title} Quiz",
      "questions": [
        {
          "question": "string",
          "options": ["A", "B", "C", "D"],
          "answerIndex": 1,
          "explanation": "Optional explanation"
        }
      ]
    }

    Summary:
    """${book.description}"""
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error('Gemini did not return any content.');
  }

  let quizPayload: unknown;
  try {
    quizPayload = JSON.parse(text);
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  const { data: inserted, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      book_id: book.id,
      created_by_id: user.id,
      questions: quizPayload,
    })
    .select('id')
    .single();

  if (quizError || !inserted) {
    throw quizError ?? new Error('Failed to save quiz.');
  }

  revalidatePath('/dashboard/library');
  return { quizId: inserted.id, quiz: quizPayload };
};
