import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Lightbox from "../components/Lightbox";
import { getPageContent } from "../services/api";
import Footer from "../components/Footer";

const GALLERY_IMAGES = [
  {
    src: "/images/wide_library_image.jpeg",
    fallback: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&h=600&fit=crop",
    alt: "Department Library",
    span: "col-span-2 row-span-2",
  },
  {
    src: "/images/bookshelf.jpeg",
    fallback: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=500&h=400&fit=crop",
    alt: "Book Collection",
    span: "",
  },
  {
    src: "/images/study.jpeg",
    fallback: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&h=400&fit=crop",
    alt: "Study Area",
    span: "",
  },
  {
    src: "/images/reading.jpeg",
    fallback: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&h=400&fit=crop",
    alt: "Reading Space",
    span: "",
  },
  {
    src: "/images/calm_reading.jpeg",
    fallback: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&h=400&fit=crop",
    alt: "Quiet Reading",
    span: "",
  },
  {
    src: "/images/fiction.jpeg",
    fallback: "https://images.unsplash.com/photo-1589998059171-988d887df646?w=500&h=400&fit=crop",
    alt: "Fiction Section",
    span: "",
  },
  {
    src: "/images/history.jpeg",
    fallback: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=500&h=400&fit=crop",
    alt: "History & Research",
    span: "",
  },
];

export default function Gallery() {
  const [lightbox, setLightbox] = useState(null);
  const [content, setContent] = useState(null);
  const [imgSrcs, setImgSrcs] = useState(Object.fromEntries(GALLERY_IMAGES.map((img) => [img.alt, img.src])));

  useEffect(() => {
    getPageContent("gallery").then(setContent).catch(() => {});
    window.scrollTo(0, 0);
  }, []);

  const handleError = (img) => {
    setImgSrcs((prev) => ({ ...prev, [img.alt]: img.fallback }));
  };

  return (
    <>
      {/* Header */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={imgSrcs["Department Library"]}
            alt=""
            className="w-full h-full object-cover opacity-20"
            onError={() => handleError(GALLERY_IMAGES[0])}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-900/80" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4 block">Visual Tour</span>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-5 tracking-tight">Gallery</h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
              {content?.subtitle || "A visual glimpse into the Department Library environment"}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[240px]">
            {GALLERY_IMAGES.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                onClick={() => setLightbox({ src: imgSrcs[img.alt], alt: img.alt })}
                className={`relative rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-shadow duration-300 ${img.span}`}
              >
                <img
                  src={imgSrcs[img.alt]}
                  alt={img.alt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={() => handleError(img)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <p className="text-white text-sm font-semibold">{img.alt}</p>
                </div>
                <div className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-slate-400 text-sm mt-10">
            Click any image to view full size
          </motion.p>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && <Lightbox image={lightbox} onClose={() => setLightbox(null)} />}

      <Footer />
    </>
  );
}
