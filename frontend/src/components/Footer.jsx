import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <span className="font-bold text-white text-base">Department Library</span>
            </div>
            <p className="text-sm leading-relaxed">
              A modern academic library system for students to discover books and receive personalized recommendations.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              {[
                { to: "/", label: "Home" },
                { to: "/about", label: "About" },
                { to: "/gallery", label: "Gallery" },
                { to: "/books", label: "Books" },
                { to: "/recommendations", label: "Recommendations" },
                { to: "/my-borrows", label: "My Borrows" },
                { to: "/account", label: "Account" },
                { to: "/login", label: "Student Login" },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-blue-400 transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>Department Library System</li>
              <li>Academic Building, Room 101</li>
              <li>library@department.edu</li>
              <li>Mon-Fri: 8 AM - 8 PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p>&copy; {new Date().getFullYear()} Department Library. All rights reserved.</p>
          <p className="text-slate-500">Built for academic excellence.</p>
        </div>
      </div>
    </footer>
  );
}

