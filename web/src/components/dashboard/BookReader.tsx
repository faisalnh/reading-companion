'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { PDFDocumentProxy } from 'react-pdf';
import { evaluateAchievements, recordReadingProgress } from '@/app/(dashboard)/dashboard/student/actions';

type ReactPDFModule = typeof import('react-pdf');

type BookReaderProps = {
  bookId: number;
  pdfUrl: string;
  initialPage?: number;
  expectedPages?: number | null;
};

const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const DISPLAY_MODES = {
  SPREAD: 'spread',
  SINGLE: 'single',
} as const;

type DisplayMode = (typeof DISPLAY_MODES)[keyof typeof DISPLAY_MODES];

export const BookReader = ({ bookId, pdfUrl, initialPage = 1, expectedPages }: BookReaderProps) => {
  const [reactPdf, setReactPdf] = useState<ReactPDFModule | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [basePageWidth, setBasePageWidth] = useState(360);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const [flipAnimationId, setFlipAnimationId] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DISPLAY_MODES.SPREAD);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const achievementAwardedRef = useRef(false);
  const bookContainerRef = useRef<HTMLDivElement | null>(null);

  const normalizedPage = useMemo(() => {
    if (!numPages) return Math.max(currentPage, 1);
    return Math.min(Math.max(currentPage, 1), numPages);
  }, [currentPage, numPages]);

  const pageSpread = useMemo(() => {
    const rawLeft =
      displayMode === DISPLAY_MODES.SPREAD && normalizedPage > 1
        ? normalizedPage % 2 === 0
          ? normalizedPage - 1
          : normalizedPage
        : normalizedPage;
    const leftPage = Math.max(rawLeft, 1);
    const rightCandidate = leftPage + 1;
    const rightPage =
      displayMode === DISPLAY_MODES.SPREAD && numPages && rightCandidate <= numPages ? rightCandidate : null;

    return { leftPage, rightPage };
  }, [normalizedPage, numPages, displayMode]);

  const lastVisiblePage =
    displayMode === DISPLAY_MODES.SPREAD ? pageSpread.rightPage ?? pageSpread.leftPage : pageSpread.leftPage;
  const pageIncrement = displayMode === DISPLAY_MODES.SPREAD ? 2 : 1;
  const effectivePageWidth = Math.round(basePageWidth * zoom);
  const zoomLabel = `${Math.round(zoom * 100)}%`;

  useEffect(() => {
    if (!numPages || !lastVisiblePage) {
      return;
    }
    const timeout = setTimeout(() => {
      setStatus('saving');
      recordReadingProgress({ bookId, currentPage: lastVisiblePage })
        .catch((err) => {
          console.error(err);
          setError('Unable to save progress automatically.');
        })
        .finally(() => setStatus('idle'));
    }, 1200);

    return () => clearTimeout(timeout);
  }, [bookId, lastVisiblePage, numPages]);

  useEffect(() => {
    const target = expectedPages ?? numPages;
    if (!target || lastVisiblePage < target || achievementAwardedRef.current) {
      return;
    }

    achievementAwardedRef.current = true;
    evaluateAchievements().catch((err) => console.error(err));
  }, [lastVisiblePage, expectedPages, numPages]);

  useEffect(() => {
    achievementAwardedRef.current = false;
  }, [bookId]);

  const handleLoadSuccess = (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
  };

  const goToPage = (page: number) => {
    setHasInteracted(true);
    setFlipDirection(page >= normalizedPage ? 'forward' : 'backward');
    setFlipAnimationId((id) => (id + 1) % 2);
    setCurrentPage(() => {
      if (!numPages) {
        return Math.max(page, 1);
      }

      return Math.min(Math.max(page, 1), numPages);
    });
  };

  useEffect(() => {
    let isMounted = true;

    import('react-pdf')
      .then((module) => {
        if (!isMounted) {
          return;
        }

        if (typeof window !== 'undefined') {
          module.pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        }

        setReactPdf(module);
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load the PDF viewer.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !bookContainerRef.current) {
      return;
    }

    const target = bookContainerRef.current;
    const updateWidth = (containerWidth: number) => {
      const columns = displayMode === DISPLAY_MODES.SPREAD ? 2 : 1;
      const gutter = columns === 2 ? 32 : 24;
      const maxWidth = columns === 2 ? 420 : 560;
      const computedWidth = Math.max(220, Math.min(maxWidth, Math.floor(containerWidth / columns) - gutter));
      setBasePageWidth(computedWidth);
    };

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width);
    });

    observer.observe(target);
    updateWidth(target.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [displayMode]);

  useEffect(() => {
    if (displayMode === DISPLAY_MODES.SPREAD && normalizedPage % 2 === 0) {
      setCurrentPage((page) => Math.max(page - 1, 1));
    }
  }, [displayMode, normalizedPage]);

  const adjustZoom = (delta: number) => {
    setZoom((value) => {
      const next = Math.min(1.8, Math.max(0.6, parseFloat((value + delta).toFixed(2))));
      return next;
    });
  };

  const turnForward = () => {
    if (!numPages || lastVisiblePage >= numPages) return;
    goToPage(pageSpread.leftPage + pageIncrement);
  };

  const turnBackward = () => {
    if (pageSpread.leftPage <= 1) return;
    const previousTarget = Math.max(pageSpread.leftPage - pageIncrement, 1);
    goToPage(previousTarget);
  };

  const handleSpreadClick = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;
    const isColumnLayout = bounds.width < 600 || bounds.height > bounds.width * 1.4;

    if (isColumnLayout) {
      if (clickY > bounds.height / 2) {
        turnForward();
      } else {
        turnBackward();
      }
      return;
    }

    if (clickX > bounds.width / 2) {
      turnForward();
    } else {
      turnBackward();
    }
  };

  const DocumentComponent = reactPdf?.Document;
  const PageComponent = reactPdf?.Page;
  const reachedBookStart = pageSpread.leftPage <= 1;
  const reachedBookEnd = Boolean(numPages) && lastVisiblePage >= numPages;
  const spreadAnimationClass = hasInteracted
    ? flipDirection === 'forward'
      ? flipAnimationId === 0
        ? 'book-spread--forward-a'
        : 'book-spread--forward-b'
      : flipAnimationId === 0
        ? 'book-spread--backward-a'
        : 'book-spread--backward-b'
    : null;

  return (
    <div className="space-y-4 rounded-2xl border border-white/15 bg-slate-950/40 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <button
            type="button"
            onClick={() => turnBackward()}
            disabled={reachedBookStart}
            className="rounded-lg border border-white/20 px-3 py-1 text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
          >
            Turn Back
          </button>
          <span>
            {displayMode === DISPLAY_MODES.SPREAD ? 'Pages ' : 'Page '}
            {pageSpread.leftPage}
            {displayMode === DISPLAY_MODES.SPREAD && pageSpread.rightPage ? `-${pageSpread.rightPage}` : ''}
            {numPages ? ` / ${numPages}` : null}
          </span>
          <button
            type="button"
            onClick={() => turnForward()}
            disabled={reachedBookEnd}
            className="rounded-lg border border-white/20 px-3 py-1 text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
          >
            Turn Page
          </button>
        </div>
        <div className="relative ml-auto flex items-center gap-2 text-sm text-white">
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            className="rounded-lg border border-white/30 px-3 py-1 text-white transition hover:bg-white/10"
          >
            Quick Settings
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/15 bg-slate-900/80 p-4 text-sm text-white">
          <div className="flex items-center gap-2">
            <span className="text-white/70">Zoom</span>
            <button
              type="button"
              onClick={() => adjustZoom(-0.1)}
              className="rounded-full border border-white/30 px-2 py-1 text-lg leading-none hover:bg-white/10"
            >
              –
            </button>
            <span className="w-12 text-center font-medium">{zoomLabel}</span>
            <button
              type="button"
              onClick={() => adjustZoom(0.1)}
              className="rounded-full border border-white/30 px-2 py-1 text-lg leading-none hover:bg-white/10"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/70">Layout</span>
            <div className="flex rounded-full border border-white/20 p-1">
              <button
                type="button"
                onClick={() => setDisplayMode(DISPLAY_MODES.SINGLE)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold transition',
                  displayMode === DISPLAY_MODES.SINGLE ? 'bg-white text-slate-900' : 'text-white/70',
                )}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode(DISPLAY_MODES.SPREAD)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold transition',
                  displayMode === DISPLAY_MODES.SPREAD ? 'bg-white text-slate-900' : 'text-white/70',
                )}
              >
                Spread
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
        <div className="text-xs text-white/60">
          {status === 'saving' ? 'Saving progress…' : 'Progress auto-saves every few seconds.'}
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div
        ref={bookContainerRef}
        className="book-viewer relative flex justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950"
        onClick={handleSpreadClick}
        role="presentation"
      >
        {DocumentComponent && PageComponent ? (
          <DocumentComponent
            file={pdfUrl}
            className={clsx('book-spread', spreadAnimationClass, !pageSpread.rightPage && 'book-spread--single')}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={(err: Error) => setError(err.message)}
            loading={<div className="p-8 text-white">Loading PDF…</div>}
          >
            <PageComponent
              className="book-page book-page--left"
              pageNumber={pageSpread.leftPage}
              width={effectivePageWidth}
              renderAnnotationLayer
              renderTextLayer
            />
            {pageSpread.rightPage ? (
              <PageComponent
                className="book-page book-page--right"
                pageNumber={pageSpread.rightPage}
                width={effectivePageWidth}
                renderAnnotationLayer
                renderTextLayer
              />
            ) : null}
          </DocumentComponent>
        ) : (
          <div className="p-8 text-white">Preparing reader…</div>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            turnBackward();
          }}
          disabled={reachedBookStart}
          className="book-hotspot book-hotspot--left"
          aria-label="Previous pages"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            turnForward();
          }}
          disabled={reachedBookEnd}
          className="book-hotspot book-hotspot--right"
          aria-label="Next pages"
        />
      </div>
    </div>
  );
};
