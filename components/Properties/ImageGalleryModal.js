'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ImageGalleryModal({ images, title = 'Property', onClose }) {
  const urls = [...new Set((images || [])
    .map((image) => typeof image === 'string' ? image : image?.url)
    .filter(Boolean))];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + urls.length) % urls.length);
      }
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % urls.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, urls.length]);

  if (!urls.length) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} image gallery`}
    >
      <div
        className="relative flex h-full max-h-[90vh] w-full max-w-6xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/75"
          aria-label="Close image gallery"
        >
          <X className="h-6 w-6" />
        </button>
        {urls.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((current) => (current - 1 + urls.length) % urls.length)}
            className="absolute left-0 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/75"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <img
          src={urls[index]}
          alt={`${title} ${index + 1} of ${urls.length}`}
          className="max-h-full max-w-[calc(100%-3.5rem)] rounded-xl object-contain shadow-2xl"
        />
        {urls.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((current) => (current + 1) % urls.length)}
            className="absolute right-0 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/75"
            aria-label="Next image"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
        {urls.length > 1 && (
          <span className="absolute bottom-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {index + 1} / {urls.length}
          </span>
        )}
      </div>
    </div>
  );
}
