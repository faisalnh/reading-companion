'use client';

import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { generatePresignedUploadUrls, saveBookMetadata } from '@/app/(dashboard)/dashboard/librarian/actions';
import { ACCESS_LEVEL_OPTIONS, type AccessLevelValue } from '@/constants/accessLevels';

type UploadState = 'idle' | 'request' | 'upload' | 'save';
type PdfDetectionState = 'idle' | 'working' | 'error';

type BookUploadFormProps = {
  genreOptions?: string[];
  languageOptions?: string[];
  onCancel?: () => void;
  onSuccess?: () => void;
};

const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
type PdfJsModule = typeof import('pdfjs-dist');

export const BookUploadForm = ({
  genreOptions = [],
  languageOptions = [],
  onCancel,
  onSuccess,
}: BookUploadFormProps) => {
  const [status, setStatus] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pdfDetectionState, setPdfDetectionState] = useState<PdfDetectionState>('idle');
  const [pdfDetectionMessage, setPdfDetectionMessage] = useState<string | null>(null);
  const [selectedAccessLevels, setSelectedAccessLevels] = useState<Set<AccessLevelValue>>(new Set());
  const formRef = useRef<HTMLFormElement | null>(null);

  const genreListId = useId();
  const languageListId = useId();

  const normalizedGenreOptions = useMemo(
    () =>
      Array.from(new Set(genreOptions.filter((value): value is string => Boolean(value && value.trim())))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [genreOptions],
  );

  const normalizedLanguageOptions = useMemo(
    () =>
      Array.from(new Set(languageOptions.filter((value): value is string => Boolean(value && value.trim())))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [languageOptions],
  );

  const loadPdfModule = async (): Promise<PdfJsModule> => {
    const pdfModule = await import('pdfjs-dist');
    if (pdfModule.GlobalWorkerOptions?.workerSrc !== workerSrc) {
      pdfModule.GlobalWorkerOptions.workerSrc = workerSrc;
    }
    return pdfModule;
  };

  const extractPageCount = async (file: File) => {
    const pdfModule = await loadPdfModule();
    const buffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(buffer);
    const document = await pdfModule.getDocument({ data: typedArray }).promise;
    return document.numPages;
  };

  const toggleAccessLevel = (level: AccessLevelValue) => {
    setSelectedAccessLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const handlePdfFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPageCount(null);
    setPdfDetectionMessage(null);

    if (!file) {
      setPdfDetectionState('idle');
      return;
    }

    setPdfDetectionState('working');
    try {
      const detectedPages = await extractPageCount(file);
      setPageCount(detectedPages);
      setPdfDetectionState('idle');
    } catch (err) {
      console.error('Failed to detect page count:', err);
      setPdfDetectionState('error');
      setPdfDetectionMessage('Unable to detect page count from this PDF.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const isbn = String(formData.get('isbn') ?? '').trim();
    const title = String(formData.get('title') ?? '').trim();
    const author = String(formData.get('author') ?? '').trim();
    const publisher = String(formData.get('publisher') ?? '').trim();
    const publicationYearRaw = Number(formData.get('publicationYear') ?? '0');
    const publicationYear = Number.isFinite(publicationYearRaw) && publicationYearRaw > 0 ? publicationYearRaw : undefined;
    const description = String(formData.get('description') ?? '').trim();
    const genre = String(formData.get('genre') ?? '').trim();
    const language = String(formData.get('language') ?? '').trim();
    const pdfFile = formData.get('pdfFile') as File | null;
    const coverFile = formData.get('coverFile') as File | null;
    const accessLevels = Array.from(selectedAccessLevels);

    if (!isbn) {
      setError('ISBN is required.');
      return;
    }

    if (!title) {
      setError('Title is required.');
      return;
    }

    if (!author) {
      setError('Author is required.');
      return;
    }

    if (!publisher) {
      setError('Publisher is required.');
      return;
    }

    if (!publicationYear) {
      setError('A valid publication year is required.');
      return;
    }

    if (!genre) {
      setError('Genre is required.');
      return;
    }

    if (!language) {
      setError('Language is required.');
      return;
    }

    if (!accessLevels.length) {
      setError('Select at least one access level.');
      return;
    }

    if (!pdfFile || pdfFile.size === 0) {
      setError('A PDF file is required.');
      return;
    }

    if (!coverFile || coverFile.size === 0) {
      setError('A cover image is required.');
      return;
    }

    try {
      setPdfDetectionMessage(null);
      setPdfDetectionState('idle');

      let resolvedPageCount = pageCount;

      if (!resolvedPageCount) {
        setPdfDetectionState('working');
        try {
          resolvedPageCount = await extractPageCount(pdfFile);
          setPageCount(resolvedPageCount);
          setPdfDetectionState('idle');
          setPdfDetectionMessage(null);
        } catch (ex) {
          setPdfDetectionState('error');
          setPdfDetectionMessage('Unable to detect page count from the PDF.');
          throw ex instanceof Error ? ex : new Error('Unable to detect page count from the PDF.');
        }
      }

      if (!resolvedPageCount) {
        setError('Unable to detect page count from the PDF. Please try another file.');
        return;
      }

      setStatus('request');
      const uploadInfo = await generatePresignedUploadUrls({
        pdfFilename: pdfFile.name,
        coverFilename: coverFile.name,
      });

      setStatus('upload');
      const [pdfResponse, coverResponse] = await Promise.all([
        fetch(uploadInfo.pdfUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': pdfFile.type || 'application/pdf' },
          body: pdfFile,
        }),
        fetch(uploadInfo.coverUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type || 'image/png' },
          body: coverFile,
        }),
      ]);

      if (!pdfResponse.ok || !coverResponse.ok) {
        throw new Error('Upload to MinIO failed.');
      }

      setStatus('save');
      await saveBookMetadata({
        isbn,
        title,
        author,
        publisher,
        publicationYear,
        genre,
        language,
        description,
        pageCount: resolvedPageCount,
        accessLevels,
        pdfUrl: uploadInfo.pdfPublicUrl,
        coverUrl: uploadInfo.coverPublicUrl,
      });

      setSuccess('Book uploaded successfully.');
      form.reset();
      setPageCount(null);
      setPdfDetectionState('idle');
      setPdfDetectionMessage(null);
      setSelectedAccessLevels(new Set());
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
    } finally {
      setStatus('idle');
    }
  };

  const isBusy = status !== 'idle';

  const handleCancel = () => {
    formRef.current?.reset();
    setError(null);
    setSuccess(null);
    setPageCount(null);
    setPdfDetectionState('idle');
    setPdfDetectionMessage(null);
    setSelectedAccessLevels(new Set());
    onCancel?.();
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">Add New Book</h2>
        <p className="text-sm text-slate-400">Upload the PDF, cover image, and metadata.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-white">
          ISBN
          <input
            name="isbn"
            required
            maxLength={32}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="9780743273565"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Title
          <input
            name="title"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="The Great Gatsby"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Author
          <input
            name="author"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="F. Scott Fitzgerald"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Publisher
          <input
            name="publisher"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="Charles Scribner's Sons"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Year
          <input
            name="publicationYear"
            type="number"
            min={1800}
            max={3000}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="1925"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Genre
          <input
            name="genre"
            list={genreListId}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="Classics"
          />
          {normalizedGenreOptions.length ? (
            <datalist id={genreListId}>
              {normalizedGenreOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null}
          <p className="text-xs text-white/60">Choose an existing genre or type a new one.</p>
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Language
          <input
            name="language"
            list={languageListId}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="English"
          />
          {normalizedLanguageOptions.length ? (
            <datalist id={languageListId}>
              {normalizedLanguageOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null}
          <p className="text-xs text-white/60">Pick from the list or enter a new language.</p>
        </label>

        <label className="space-y-2 text-sm font-medium text-white md:col-span-2">
          Description
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="Quick summary for librarians and AI quiz prompts."
          />
        </label>

        <fieldset className="space-y-2 text-sm font-medium text-white md:col-span-2">
          <legend>Access</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACCESS_LEVEL_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/50 bg-transparent text-slate-900 focus:ring-white/60"
                  checked={selectedAccessLevels.has(option.value)}
                  onChange={() => toggleAccessLevel(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-white/60">Choose who can access this title. Select at least one group.</p>
        </fieldset>

        <div className="space-y-2 text-sm font-medium text-white">
          Detected page count
          <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
            {pageCount ? `${pageCount} pages` : 'Select a PDF to detect page count'}
          </div>
          {pdfDetectionState === 'working' ? (
            <p className="text-xs text-white/60">Analyzing PDF…</p>
          ) : null}
          {pdfDetectionState === 'error' && pdfDetectionMessage ? (
            <p className="text-xs text-red-300">{pdfDetectionMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-white">
          Book PDF
          <input
            name="pdfFile"
            type="file"
            accept="application/pdf"
            required
            onChange={handlePdfFileChange}
            className="w-full rounded-lg border border-dashed border-white/20 bg-transparent px-3 py-2 text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/90 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Cover image
          <input
            name="coverFile"
            type="file"
            accept="image/*"
            required
            className="w-full rounded-lg border border-dashed border-white/20 bg-transparent px-3 py-2 text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/90 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isBusy}
          className="flex-1 rounded-lg bg-white/90 px-4 py-3 font-semibold text-slate-900 transition hover:bg-white disabled:pointer-events-none disabled:opacity-50 sm:flex-none sm:px-6"
        >
          {isBusy
            ? status === 'request'
              ? 'Preparing uploads…'
              : status === 'upload'
                ? 'Uploading files…'
                : 'Saving book…'
            : 'Upload book'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-white/30 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
