import { useEffect, useState } from "react";
/* eslint-disable-next-line no-unused-vars */
import { motion } from "framer-motion";
import { getPageContent } from "../services/api";
import Footer from "../components/Footer";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: "easeOut" },
};

const OBJECTIVES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
    ),
    title: "Easy Book Discovery",
    desc: "Instantly search and browse books by title, author, category, or keyword with powerful filters.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Personalized Recommendations",
    desc: "Get tailored book suggestions based on your reading history and interaction patterns.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Admin Management",
    desc: "A dedicated panel for librarians/admins to manage inventory, borrowers, and content.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
    title: "Scalable Architecture",
    desc: "Built with a modern tech stack designed to scale with the student population.",
  },
];

const TECH = [
  { label: "Frontend", value: "React.js" },
  { label: "Styling", value: "Tailwind CSS" },
  { label: "Backend", value: "Django" },
  { label: "Database", value: "PostgreSQL" },
  { label: "Recommendation Logic", value: "Predictive Analysis" },
];

export default function AboutUs() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    getPageContent("about")
      .then(setContent)
      .catch(() => {});
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      {/* Header */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400 rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-4 block">
              Who We Are
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-5 tracking-tight">
              About the Library
            </h1>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto leading-relaxed">
              {content?.subtitle || "Learn more about the Department Library System and its purpose."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div {...fadeUp}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-6">Department Library System</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-5">
                {content?.main_description ||
                  "The Department Library System is a comprehensive digital platform designed to serve students and faculty with seamless access to a rich collection of academic books, literature, and research materials."}
              </p>
              <p className="text-slate-600 leading-relaxed mb-5">
                Students can discover books across categories, search by keyword or author, and receive intelligent recommendations based on their academic interests.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Our goal is to empower every student with tools that make knowledge accessible, organized, and personally relevant.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3 block">Our Mission</span>
            <h2 className="text-4xl font-extrabold text-slate-900">Key Objectives</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OBJECTIVES.map((obj, i) => (
              <motion.div
                key={i}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                  {obj.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{obj.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{obj.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <motion.div {...fadeUp}>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4 block">Under the Hood</span>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-6">Technology Stack</h2>
              <p className="text-slate-600 leading-relaxed mb-8">
                The Department Library is built with a modern tech stack chosen for reliability, performance, and developer experience.
              </p>
              <div className="space-y-4">
                {TECH.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-sm font-semibold text-slate-500 w-40 shrink-0">{item.label}:</span>
                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Built for Students</h3>
                <p className="text-blue-100 leading-relaxed mb-6">
                  Every feature was designed for the student experience — fast discovery, intuitive navigation, and smart recommendations.
                </p>
                <ul className="space-y-3 text-blue-100 text-sm">
                  {["Mobile-first responsive design", "Accessibility-first components", "Real-time search and filters", "Secure authentication system", "Fast API responses"].map(
                    (item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
