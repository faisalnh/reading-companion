'use client';

import { useId, useMemo, useState, useTransition, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { deleteBook, updateBookMetadata } from '@/app/(dashboard)/dashboard/librarian/actions';
import { ACCESS_LEVEL_OPTIONS, type AccessLevelValue } from '@/constants/accessLevels';

export type ManagedBookRecord = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: number;
  genre: string;
  language: string;
  description: string | null;
  pageCount: number | null;
  pdfUrl: string;
  coverUrl: string;
  createdAt?: string | null;
  accessLevels: AccessLevelValue[];
};

const ACCESS_BADGES: Record<AccessLevelValue, { label: string; color: string }> = {
  KINDERGARTEN: { label: 'K', color: 'bg-emerald-500/90 text-emerald-950' },
  LOWER_ELEMENTARY: { label: 'LE', color: 'bg-sky-400/90 text-sky-950' },
  UPPER_ELEMENTARY: { label: 'UE', color: 'bg-blue-500/90 text-blue-50' },
  JUNIOR_HIGH: { label: 'JH', color: 'bg-purple-500/90 text-purple-50' },
  TEACHERS_STAFF: { label: 'TS', color: 'bg-amber-400/90 text-amber-950' },
};

type BookManagerProps = {
  books: ManagedBookRecord[];
  genreOptions?: string[];
  languageOptions?: string[];
  onAddBookClick?: () => void;
  isAddPanelOpen?: boolean;
};

type EditFormState = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: string;
  genre: string;
  language: string;
  description: string;
  accessLevels: AccessLevelValue[];
};

const createEditFormState = (book: ManagedBookRecord): EditFormState => ({
  isbn: book.isbn,
  title: book.title,
  author: book.author,
  publisher: book.publisher,
  publicationYear: String(book.publicationYear || ''),
  genre: book.genre,
  language: book.language,
  description: book.description ?? '',
  accessLevels: [...book.accessLevels],
});

export const BookManager = ({
  books,
  genreOptions = [],
  languageOptions = [],
  onAddBookClick,
  isAddPanelOpen = false,
}: BookManagerProps) => {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [authorFilter, setAuthorFilter] = useState<string>('ALL');
  const [publisherFilter, setPublisherFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessLevelValue | 'ALL'>('ALL');
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const genreListId = useId();
  const languageListId = useId();

  const sortedBooks = useMemo(
    () =>
      [...books].sort((a, b) => {
        if (!a.createdAt || !b.createdAt) {
          return b.id - a.id;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [books],
  );

  const activeBook = editingId ? books.find((book) => book.id === editingId) ?? null : null;
  const authorOptions = useMemo(
    () =>
      Array.from(new Set(books.map((book) => book.author).filter((value) => Boolean(value && value.trim())))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [books],
  );
  const publisherOptions = useMemo(
    () =>
      Array.from(new Set(books.map((book) => book.publisher).filter((value) => Boolean(value && value.trim())))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [books],
  );
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(books.map((book) => book.publicationYear).filter((value) => Number.isFinite(value)))).sort(
        (a, b) => b - a,
      ),
    [books],
  );

  const filteredBooks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedBooks.filter((book) => {
      if (genreFilter !== 'ALL' && book.genre !== genreFilter) {
        return false;
      }

      if (languageFilter !== 'ALL' && book.language !== languageFilter) {
        return false;
      }

      if (authorFilter !== 'ALL' && book.author !== authorFilter) {
        return false;
      }

      if (publisherFilter !== 'ALL' && book.publisher !== publisherFilter) {
        return false;
      }

      if (yearFilter !== 'ALL' && String(book.publicationYear) !== yearFilter) {
        return false;
      }

      if (accessFilter !== 'ALL' && !book.accessLevels.includes(accessFilter)) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [book.title, book.author, book.isbn, book.publisher].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedBooks, searchTerm, genreFilter, languageFilter, authorFilter, publisherFilter, yearFilter, accessFilter]);

  const handleEdit = (book: ManagedBookRecord) => {
    setEditingId(book.id);
    setEditForm(createEditFormState(book));
    setFeedback(null);
  };

  const handleFieldChange = (field: Exclude<keyof EditFormState, 'accessLevels'>, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId || !editForm) {
      return;
    }

    const trimmed = {
      isbn: editForm.isbn.trim(),
      title: editForm.title.trim(),
      author: editForm.author.trim(),
      publisher: editForm.publisher.trim(),
      genre: editForm.genre.trim(),
      language: editForm.language.trim(),
      description: editForm.description.trim(),
      publicationYear: Number(editForm.publicationYear),
    };
    const accessLevels = editForm.accessLevels;

    if (
      !trimmed.isbn ||
      !trimmed.title ||
      !trimmed.author ||
      !trimmed.publisher ||
      !trimmed.genre ||
      !trimmed.language ||
      !Number.isFinite(trimmed.publicationYear) ||
      accessLevels.length === 0
    ) {
      setFeedback({ type: 'error', message: 'All metadata fields and access levels are required.' });
      return;
    }

    startUpdateTransition(async () => {
      try {
        await updateBookMetadata({
          id: editingId,
          isbn: trimmed.isbn,
          title: trimmed.title,
          author: trimmed.author,
          publisher: trimmed.publisher,
          publicationYear: trimmed.publicationYear,
          genre: trimmed.genre,
          language: trimmed.language,
          description: trimmed.description || null,
          accessLevels,
        });
        setFeedback({ type: 'success', message: 'Book metadata updated.' });
        setEditingId(null);
        setEditForm(null);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update book.';
        setFeedback({ type: 'error', message });
      }
    });
  };

  const handleDelete = (book: ManagedBookRecord) => {
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) {
      return;
    }
    setDeletePendingId(book.id);
    setFeedback(null);

    startDeleteTransition(async () => {
      try {
        await deleteBook({ id: book.id });
        if (editingId === book.id) {
          setEditingId(null);
          setEditForm(null);
        }
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete book.';
        setFeedback({ type: 'error', message });
      } finally {
        setDeletePendingId(null);
      }
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Library Catalog</h2>
          <p className="text-sm text-white/70">Review, edit, or remove uploaded eBooks.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onAddBookClick}
            disabled={isAddPanelOpen}
            className="rounded-lg bg-white/90 px-4 py-2 font-semibold text-slate-900 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAddPanelOpen ? 'Adding eBook…' : 'Add eBook'}
          </button>
          {feedback ? (
            <span
              className={clsx(
                'rounded-lg border px-3 py-2 text-xs font-semibold sm:text-sm',
                feedback.type === 'success' ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300',
              )}
            >
              {feedback.message}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Search</span>
          <input
            type="search"
            placeholder="Title, author, ISBN..."
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Author</span>
          <select
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All authors</option>
            {authorOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Publisher</span>
          <select
            value={publisherFilter}
            onChange={(event) => setPublisherFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All publishers</option>
            {publisherOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Year</span>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All years</option>
            {yearOptions.map((option) => (
              <option value={String(option)} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Genre</span>
          <select
            value={genreFilter}
            onChange={(event) => setGenreFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All genres</option>
            {genreOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Language</span>
          <select
            value={languageFilter}
            onChange={(event) => setLanguageFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All languages</option>
            {languageOptions.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Access</span>
          <select
            value={accessFilter}
            onChange={(event) => setAccessFilter(event.target.value as AccessLevelValue | 'ALL')}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
          >
            <option value="ALL">All access levels</option>
            {ACCESS_LEVEL_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredBooks.length === 0 ? (
        <p className="text-sm text-white/60">
          {books.length === 0
            ? 'No books uploaded yet. Use the “Add eBook” button to create your first title.'
            : 'No books match the current filters.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/5 text-sm text-white">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Title</th>
                <th className="px-4 py-3 text-left font-semibold">ISBN</th>
                <th className="px-4 py-3 text-left font-semibold">Author</th>
                <th className="px-4 py-3 text-left font-semibold">Publisher</th>
                <th className="px-4 py-3 text-left font-semibold">Year</th>
                <th className="px-4 py-3 text-left font-semibold">Genre</th>
                <th className="px-4 py-3 text-left font-semibold">Language</th>
                <th className="px-4 py-3 text-left font-semibold">Access</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((book) => (
                <tr key={book.id} className="border-b border-white/5 bg-white/0 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{book.title}</div>
                    <div className="text-xs text-white/60">{book.author}</div>
                  </td>
                  <td className="px-4 py-3">{book.isbn}</td>
                  <td className="px-4 py-3">{book.author}</td>
                  <td className="px-4 py-3">{book.publisher}</td>
                  <td className="px-4 py-3">{book.publicationYear}</td>
                  <td className="px-4 py-3">{book.genre}</td>
                  <td className="px-4 py-3">{book.language}</td>
                  <td className="px-4 py-3 text-xs">
                    {book.accessLevels.length ? (
                      <div className="flex flex-wrap gap-2">
                        {book.accessLevels.map((level) => {
                          const badge = ACCESS_BADGES[level];
                          return (
                            <span
                              key={`${book.id}-${level}`}
                              className={clsx(
                                'rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide',
                                badge?.color ?? 'bg-white/20 text-white',
                              )}
                            >
                              {badge?.label ?? level.slice(0, 2)}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-white/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(book)}
                        className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book)}
                        disabled={isDeleting && deletePendingId === book.id}
                        className="rounded-lg border border-red-300/40 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {isDeleting && deletePendingId === book.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <h3 className="text-base font-semibold text-white">Edit Metadata</h3>
        {editingId && editForm ? (
          <form onSubmit={handleUpdateSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-white">
              ISBN
              <input
                value={editForm.isbn}
                onChange={(event) => handleFieldChange('isbn', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Title
              <input
                value={editForm.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Author
              <input
                value={editForm.author}
                onChange={(event) => handleFieldChange('author', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Publisher
              <input
                value={editForm.publisher}
                onChange={(event) => handleFieldChange('publisher', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Year
              <input
                type="number"
                min={1800}
                max={3000}
                value={editForm.publicationYear}
                onChange={(event) => handleFieldChange('publicationYear', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Genre
              <input
                list={genreListId}
                value={editForm.genre}
                onChange={(event) => handleFieldChange('genre', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
              {genreOptions.length ? (
                <datalist id={genreListId}>
                  {genreOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <label className="space-y-1 text-sm font-medium text-white">
              Language
              <input
                list={languageListId}
                value={editForm.language}
                onChange={(event) => handleFieldChange('language', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                required
              />
              {languageOptions.length ? (
                <datalist id={languageListId}>
                  {languageOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <fieldset className="md:col-span-2 space-y-1 text-sm font-medium text-white">
              <legend>Access</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACCESS_LEVEL_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/50 bg-transparent text-slate-900 focus:ring-white/60"
                      checked={Boolean(editForm?.accessLevels.includes(option.value))}
                      onChange={() => toggleEditAccessLevel(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-white/60">Select the audiences who can access this book.</p>
            </fieldset>
            <label className="md:col-span-2 space-y-1 text-sm font-medium text-white">
              Description
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
                placeholder="Optional summary for teachers and quiz generation."
              />
            </label>
            {activeBook ? (
              <div className="md:col-span-2 flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span>
                  Page count: <strong className="text-white">{activeBook.pageCount ?? '—'}</strong>
                </span>
                <a
                  href={activeBook.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/20 px-3 py-1 font-semibold text-white transition hover:bg-white/10"
                >
                  View PDF
                </a>
                <a
                  href={activeBook.coverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/20 px-3 py-1 font-semibold text-white transition hover:bg-white/10"
                >
                  View Cover
                </a>
              </div>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-lg bg-white/90 px-4 py-2 font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
              >
                {isUpdating ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditForm(null);
                  setFeedback(null);
                }}
                className="rounded-lg border border-white/20 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-white/60">Select a book from the table to edit its metadata.</p>
        )}
      </div>
    </section>
  );
};
  const toggleEditAccessLevel = (level: AccessLevelValue) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const exists = prev.accessLevels.includes(level);
      return {
        ...prev,
        accessLevels: exists ? prev.accessLevels.filter((value) => value !== level) : [...prev.accessLevels, level],
      };
    });
  };
