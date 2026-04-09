import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPageContent } from '../services/api';
import Footer from '../components/Footer';

const HERO_BG = 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1600&h=900&fit=crop';
const FEATURED_IMG = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop';
const HIGHLIGHT_IMG = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop';

const CATEGORY_IMGS = [
  { title: 'Academic & Study', img: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=280&fit=crop' },
  { title: 'Fiction & Literature', img: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=280&fit=crop' },
  { title: 'History & Research', img: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&h=280&fit=crop' },
];

const STATS = [
  { label: '6,000+ Books Available', icon: '📚' },
  { label: '1,000+ Active Students', icon: '🎓' },
  { label: '24/7 Access & Discovery', icon: '🕐' },
];

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: 'easeOut' },
};

export default function Home() {
  const [content, setContent] = useState(null);
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    getPageContent('home').then(setContent).catch(() => {});
  }, []);

  const dashboardLink = role === 'admin' ? '/admin' : role === 'librarian' ? '/librarian' : '/account';

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-blue-900/60 to-slate-900/70" />
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4 py-32">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <span className="inline-block text-sm font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
              Department Library System
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6 tracking-tight">
              Department<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">Library</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              {content?.hero_subtitle || 'Discover books, explore knowledge, and get recommendations tailored for students.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/books" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors duration-200 text-sm shadow-lg shadow-blue-900/30">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
                Browse Books
              </Link>
              {isLoggedIn ? (
                <Link to={dashboardLink} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl border border-white/20 transition-colors duration-200 text-sm">
                  My Dashboard
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <Link to="/login" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl border border-white/20 transition-colors duration-200 text-sm">
                  Student Login
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <div className="w-5 h-8 border-2 border-white/40 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-1.5 bg-white/60 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* ── Featured Collection ──────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeUp}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
                <img src={content?.featured_image || FEATURED_IMG} alt="Library interior" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 to-transparent" />
              </div>
            </motion.div>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4 block">Featured Collection</span>
              <h2 className="text-4xl font-extrabold text-slate-900 leading-tight mb-6">
                {content?.featured_heading || 'Curated Books for Academic Excellence'}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                {content?.featured_description || 'Our Department Library offers a thoughtfully curated collection spanning textbooks, research papers, fiction, and reference materials — all designed to support your academic journey.'}
              </p>
              <Link to="/books" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:gap-4 transition-all duration-200">
                Explore the Collection
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Statistics ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-2xl font-extrabold text-white">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3 block">Browse by Category</span>
            <h2 className="text-4xl font-extrabold text-slate-900">Explore by Interest</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {CATEGORY_IMGS.map((cat, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-2xl overflow-hidden shadow-md cursor-pointer aspect-[4/3]"
                onClick={() => window.location.href = `/books`}
              >
                <img src={cat.img} alt={cat.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-xl font-bold text-white">{cat.title}</h3>
                  <p className="text-slate-300 text-sm mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Browse collection →</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlight ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeUp} className="order-2 lg:order-1">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4 block">Our Space</span>
              <h2 className="text-4xl font-extrabold text-slate-900 leading-tight mb-6">
                {content?.highlight_heading || 'A Calm Space for Learning'}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                {content?.highlight_description || 'Step into a peaceful environment crafted for focused study and discovery. Our library provides quiet reading corners, collaborative spaces, and digital access points.'}
              </p>
              <Link to="/gallery" className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold px-6 py-3 rounded-xl transition-colors duration-200 text-sm">
                See the Gallery
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="order-1 lg:order-2">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
                <img src={content?.highlight_image || HIGHLIGHT_IMG} alt="Study space" className="w-full h-full object-cover" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
