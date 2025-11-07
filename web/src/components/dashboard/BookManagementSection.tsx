'use client';

import { useEffect, useState } from 'react';
import { BookUploadForm } from '@/components/dashboard/BookUploadForm';
import { BookManager, type ManagedBookRecord } from '@/components/dashboard/BookManager';

type BookManagementSectionProps = {
  books: ManagedBookRecord[];
  genreOptions: string[];
  languageOptions: string[];
};

export const BookManagementSection = ({ books, genreOptions, languageOptions }: BookManagementSectionProps) => {
  const [showUploader, setShowUploader] = useState(false);
  const closeUploader = () => setShowUploader(false);

  useEffect(() => {
    if (!showUploader) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showUploader]);

  return (
    <div className="relative space-y-6">
      <BookManager
        books={books}
        genreOptions={genreOptions}
        languageOptions={languageOptions}
        onAddBookClick={() => setShowUploader(true)}
        isAddPanelOpen={showUploader}
      />
      {showUploader ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-1 shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
          >
            <BookUploadForm
              genreOptions={genreOptions}
              languageOptions={languageOptions}
              onCancel={closeUploader}
              onSuccess={closeUploader}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
