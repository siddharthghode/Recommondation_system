"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  Bell,
  BookOpen,
  ChevronDown,
  Search,
  Settings,
  Shield,
  LogOut,
  User
} from "lucide-react";
import { useState } from "react";
function DashboardHeader({ stats }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifCount] = useState(5);
  return /* @__PURE__ */ jsxs("header", { className: "h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0 z-30 relative", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 mr-4", children: [
      /* @__PURE__ */ jsx("div", { className: "w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0", children: /* @__PURE__ */ jsx(BookOpen, { size: 16, className: "text-white" }) }),
      /* @__PURE__ */ jsxs("div", { className: "leading-tight", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 font-medium uppercase tracking-widest", children: "UniLib" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-slate-800 -mt-0.5", children: "Dashboard" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-3.5 py-1.5", children: [
      /* @__PURE__ */ jsx(Shield, { size: 13, className: "text-indigo-500 shrink-0" }),
      /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 font-medium", children: "Department:" }),
      /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-indigo-700", children: stats.department })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 max-w-sm ml-4 relative", children: [
      /* @__PURE__ */ jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Search books, members, ISBN\u2026",
          className: "w-full h-9 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1" }),
    /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-400 font-medium hidden lg:block", children: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) }),
    /* @__PURE__ */ jsxs("button", { className: "relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500", children: [
      /* @__PURE__ */ jsx(Bell, { size: 17 }),
      notifCount > 0 && /* @__PURE__ */ jsx("span", { className: "absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center", children: notifCount })
    ] }),
    /* @__PURE__ */ jsx("button", { className: "w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500", children: /* @__PURE__ */ jsx(Settings, { size: 17 }) }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setProfileOpen((p) => !p),
          className: "flex items-center gap-2.5 pl-2 pr-1 h-9 rounded-lg hover:bg-slate-100 transition",
          children: [
            /* @__PURE__ */ jsx("div", { className: "w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold", children: "LM" }),
            /* @__PURE__ */ jsxs("div", { className: "text-left leading-tight hidden md:block", children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-slate-800", children: "L. Mitchell" }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-400", children: "Sr. Librarian" })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { size: 13, className: "text-slate-400" })
          ]
        }
      ),
      profileOpen && /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-11 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50", children: [
        /* @__PURE__ */ jsxs("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition", children: [
          /* @__PURE__ */ jsx(User, { size: 14, className: "text-slate-400" }),
          "My Profile"
        ] }),
        /* @__PURE__ */ jsxs("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition", children: [
          /* @__PURE__ */ jsx(Settings, { size: 14, className: "text-slate-400" }),
          "Preferences"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "my-1 border-t border-slate-100" }),
        /* @__PURE__ */ jsxs("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition", children: [
          /* @__PURE__ */ jsx(LogOut, { size: 14 }),
          "Sign Out"
        ] })
      ] })
    ] })
  ] });
}
export {
  DashboardHeader as default
};
