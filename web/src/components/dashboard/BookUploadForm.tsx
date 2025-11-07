'use client';

import { useState, type FormEvent } from 'react';
import { generatePresignedUploadUrls, saveBookMetadata } from '@/app/(dashboard)/dashboard/librarian/actions';

type UploadState = 'idle' | 'request' | 'upload' | 'save';

export const BookUploadForm = () => {
  const [status, setStatus] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const title = String(formData.get('title') ?? '').trim();
    const author = String(formData.get('author') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const category = String(formData.get('category') ?? '').trim();
    const gradeLevel = Number(formData.get('gradeLevel') ?? '0') || undefined;
    const pageCount = Number(formData.get('pageCount') ?? '0') || undefined;
    const pdfFile = formData.get('pdfFile') as File | null;
    const coverFile = formData.get('coverFile') as File | null;

    if (!pdfFile || pdfFile.size === 0) {
      setError('A PDF file is required.');
      return;
    }

    if (!coverFile || coverFile.size === 0) {
      setError('A cover image is required.');
      return;
    }

    try {
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
        title,
        author,
        description,
        category,
        gradeLevel,
        pageCount,
        pdfUrl: uploadInfo.pdfPublicUrl,
        coverUrl: uploadInfo.coverPublicUrl,
      });

      setSuccess('Book uploaded successfully.');
      form.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
    } finally {
      setStatus('idle');
    }
  };

  const isBusy = status !== 'idle';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Add New Book</h2>
        <p className="text-sm text-slate-400">Upload the PDF, cover image, and metadata.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          Category
          <input
            name="category"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="Classics"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-white">
          Grade level
          <input
            name="gradeLevel"
            type="number"
            min={1}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="9"
          />
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

        <label className="space-y-2 text-sm font-medium text-white">
          Page count
          <input
            name="pageCount"
            type="number"
            min={1}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/30"
            placeholder="180"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-white">
          Book PDF
          <input
            name="pdfFile"
            type="file"
            accept="application/pdf"
            required
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

      <button
        type="submit"
        disabled={isBusy}
        className="w-full rounded-lg bg-white/90 px-4 py-3 font-semibold text-slate-900 transition hover:bg-white disabled:pointer-events-none disabled:opacity-50"
      >
        {isBusy
          ? status === 'request'
            ? 'Preparing uploads…'
            : status === 'upload'
              ? 'Uploading files…'
              : 'Saving book…'
          : 'Upload book'}
      </button>
    </form>
  );
};
