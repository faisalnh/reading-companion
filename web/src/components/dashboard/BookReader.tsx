"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlipBookReader } from "@/components/dashboard/FlipBookReader";
import {
  evaluateAchievements,
  recordReadingProgress,
} from "@/app/(dashboard)/dashboard/student/actions";

type PageImageInfo = {
  baseUrl: string;
  count: number;
};

type BookReaderProps = {
  bookId: number;
  pdfUrl: string;
  initialPage?: number;
  expectedPages?: number | null;
  pageImages?: PageImageInfo | null;
};

export const BookReader = ({
  bookId,
  pdfUrl,
  initialPage = 1,
  expectedPages,
  pageImages,
}: BookReaderProps) => {
  const [flipError, setFlipError] = useState<string | null>(null);
  const achievementsTriggeredRef = useRef(false);

  useEffect(() => {
    achievementsTriggeredRef.current = false;
  }, [bookId]);

  const handleFlipProgress = useCallback(
    (pageNumber: number) => {
      setFlipError(null);
      recordReadingProgress({ bookId, currentPage: pageNumber })
        .then(() => {
          if (
            expectedPages &&
            pageNumber >= expectedPages &&
            !achievementsTriggeredRef.current
          ) {
            achievementsTriggeredRef.current = true;
            return evaluateAchievements();
          }
          return undefined;
        })
        .catch((err) => {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to save reading progress.";
          setFlipError(message);
        });
    },
    [bookId, expectedPages],
  );

  if (!pageImages || pageImages.count === 0) {
    return (
      <div className="rounded-3xl border-4 border-red-300 bg-red-50 p-8">
        <p className="text-center text-lg font-bold text-red-600">
          📚 This book hasn't been rendered yet. Please contact your librarian.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FlipBookReader
        pageImages={pageImages}
        initialPage={initialPage}
        fallbackPdfUrl={pdfUrl}
        onPageChange={handleFlipProgress}
      />
      {flipError ? (
        <p className="text-sm font-semibold text-red-500">{flipError}</p>
      ) : null}
    </div>
  );
};
