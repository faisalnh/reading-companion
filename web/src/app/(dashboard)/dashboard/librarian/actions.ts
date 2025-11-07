'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getMinioBucketName, getMinioClient } from '@/lib/minio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccessLevelValue } from '@/constants/accessLevels';

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

const ensureLibrarianOrAdmin = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to manage books.');
  }

  const { data: profiles, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id);

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
      `Insufficient permissions. Your current role is: ${profile?.role || 'unknown'}. Only LIBRARIAN or ADMIN users can manage books.`,
    );
  }
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

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const getObjectKeyFromPublicUrl = (publicUrl: string | null | undefined) => {
  if (!publicUrl) {
    return null;
  }

  const bucketName = getMinioBucketName();
  const publicBaseUrl = getPublicBaseUrl();
  const normalizedUrl = publicUrl.trim();

  if (!normalizedUrl) {
    return null;
  }

  const prefix = `${publicBaseUrl.replace(/\/$/, '')}/${bucketName}/`;
  if (normalizedUrl.startsWith(prefix)) {
    return normalizedUrl.slice(prefix.length);
  }

  try {
    const parsed = new URL(normalizedUrl);
    const pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeSegment(segment));

    if (!pathParts.length) {
      return null;
    }

    if (pathParts[0] === bucketName) {
      return pathParts.slice(1).join('/');
    }

    return pathParts.join('/');
  } catch {
    return null;
  }
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
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear?: number;
  genre: string;
  language: string;
  description?: string;
  pageCount: number;
  accessLevels: AccessLevelValue[];
  pdfUrl: string;
  coverUrl: string;
}) => {
  await ensureLibrarianOrAdmin();

  if (!input.accessLevels?.length) {
    throw new Error('At least one access level is required.');
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: insertedBook, error } = await supabaseAdmin
    .from('books')
    .insert({
      isbn: input.isbn,
      title: input.title,
      author: input.author,
      publisher: input.publisher,
      publication_year: input.publicationYear,
      genre: input.genre,
      language: input.language,
      description: input.description,
      page_count: input.pageCount,
      pdf_url: input.pdfUrl,
      cover_url: input.coverUrl,
    })
    .select('id')
    .single();

  if (error || !insertedBook) {
    console.error('Book insert error:', error);
    throw error ?? new Error('Unable to insert book.');
  }

  const { error: accessInsertError } = await supabaseAdmin
    .from('book_access')
    .insert(input.accessLevels.map((level) => ({ book_id: insertedBook.id, access_level: level })));

  if (accessInsertError) {
    console.error('Book access insert error:', accessInsertError);
    throw accessInsertError;
  }

  revalidatePath('/dashboard/library');
  revalidatePath('/dashboard/librarian');
};

export const updateBookMetadata = async (input: {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: number;
  genre: string;
  language: string;
  description?: string | null;
  accessLevels: AccessLevelValue[];
}) => {
  await ensureLibrarianOrAdmin();

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from('books')
    .update({
      isbn: input.isbn,
      title: input.title,
      author: input.author,
      publisher: input.publisher,
      publication_year: input.publicationYear,
      genre: input.genre,
      language: input.language,
      description: input.description ?? null,
    })
    .eq('id', input.id);

  if (error) {
    console.error('Book update error:', error);
    throw error;
  }

  if (!input.accessLevels?.length) {
    throw new Error('At least one access level is required.');
  }

  const { error: deleteAccessError } = await supabaseAdmin.from('book_access').delete().eq('book_id', input.id);
  if (deleteAccessError) {
    console.error('Book access delete error:', deleteAccessError);
    throw deleteAccessError;
  }

  const { error: insertAccessError } = await supabaseAdmin
    .from('book_access')
    .insert(input.accessLevels.map((level) => ({ book_id: input.id, access_level: level })));

  if (insertAccessError) {
    console.error('Book access insert error:', insertAccessError);
    throw insertAccessError;
  }

  revalidatePath('/dashboard/library');
  revalidatePath('/dashboard/librarian');

  return { success: true };
};

export const deleteBook = async (input: { id: number }) => {
  await ensureLibrarianOrAdmin();

  const supabaseAdmin = getSupabaseAdminClient();
  const minioClient = getMinioClient();
  const bucketName = getMinioBucketName();

  const { data: book, error: bookError } = await supabaseAdmin
    .from('books')
    .select('pdf_url, cover_url')
    .eq('id', input.id)
    .single();

  if (bookError) {
    throw new Error('Unable to locate book for deletion.');
  }

  const pdfObjectKey = getObjectKeyFromPublicUrl(book?.pdf_url);
  const coverObjectKey = getObjectKeyFromPublicUrl(book?.cover_url);

  for (const objectKey of [pdfObjectKey, coverObjectKey]) {
    if (!objectKey) continue;
    await minioClient.removeObject(bucketName, objectKey);
  }

  const { error } = await supabaseAdmin.from('books').delete().eq('id', input.id);

  if (error) {
    console.error('Book delete error:', error);
    throw error;
  }

  revalidatePath('/dashboard/library');
  revalidatePath('/dashboard/librarian');

  return { success: true };
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
