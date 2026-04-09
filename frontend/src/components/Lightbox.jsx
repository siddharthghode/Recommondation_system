import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Lightbox(props) {
  const { images, index, image, onClose, onPrev, onNext } = props;

  // Keyboard + overflow handling:
  // - Orchids mode: Escape closes, body scrolling disabled
  // - Carousel mode: Escape closes, ArrowLeft/ArrowRight navigate
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (!image) {
        if (e.key === "ArrowLeft") onPrev?.();
        if (e.key === "ArrowRight") onNext?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose, onPrev, onNext]);

  useEffect(() => {
    if (!image) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [image]);

  // Orchids mode: <Lightbox image={...} onClose={...} />
  if (image) {
    return (
      <AnimatePresence>
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            key={image.src}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[85vh] max-w-full object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 py-4">
              <p className="text-white font-medium text-sm">{image.alt}</p>
            </div>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (index == null) return null;
  if (!images?.length) return null;

  const img = images[index];

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          key={img.src}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="max-w-4xl w-full bg-white rounded shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <img
              src={`/images/${img.src}`}
              alt={img.title}
              className="w-full h-[60vh] object-contain bg-black"
            />

            <button
              aria-label="Close"
              className="absolute top-3 right-3 bg-white/80 rounded-full p-2 hover:bg-white"
              onClick={onClose}
            >
              ✕
            </button>

            <button
              aria-label="Previous"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white"
              onClick={onPrev}
            >
              ←
            </button>

            <button
              aria-label="Next"
              className="absolute right-12 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white"
              onClick={onNext}
            >
              →
            </button>
          </div>

          <div className="p-4">
            <h3 className="font-semibold text-lg">{img.title}</h3>
            {img.caption && <p className="text-sm text-gray-600 mt-1">{img.caption}</p>}
            <p className="text-xs text-gray-400 mt-2">
              {index + 1} / {images.length}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
