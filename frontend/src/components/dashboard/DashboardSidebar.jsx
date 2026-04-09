"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  LayoutDashboard,
  BookMarked,
  Users,
  BarChart3,
  QrCode,
  PlusSquare,
  ClipboardList,
  AlertTriangle,
  Settings2,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

function DashboardSidebar({ onScanQR, onAddBook, booksCount = "4.8K", membersCount = 312, overdueCount = 47 }) {
  const [hovered, setHovered] = useState(null);
  const location = useLocation();

  const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/librarian", active: location.pathname === "/librarian" },
    { icon: BookMarked, label: "Catalogue", badge: booksCount, href: "/books", active: location.pathname === "/books" },
    { icon: ClipboardList, label: "Manage Books", href: "/manage-books", active: location.pathname === "/manage-books" },
    { icon: Users, label: "Members", badge: membersCount, href: "/view-students", active: location.pathname === "/view-students" },
    { icon: AlertTriangle, label: "Overdue", badge: overdueCount, accent: "rose", href: "#" },
    { icon: BarChart3, label: "Reports", href: "#" },
    { icon: Settings2, label: "Settings", href: "#" }
  ];

  return /* @__PURE__ */ jsxs("aside", { className: "w-[220px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full", children: [
    /* @__PURE__ */ jsxs("nav", { className: "flex-1 px-3 pt-5 space-y-0.5 overflow-y-auto", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 pb-2", children: "Navigation" }),
      NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isHov = hovered === item.label;
        const badgeColor = item.accent === "rose" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500";
        return /* @__PURE__ */ jsxs(
          Link,
          {
            to: item.href,
            onMouseEnter: () => setHovered(item.label),
            onMouseLeave: () => setHovered(null),
            className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                ${item.active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : isHov ? "bg-slate-50 text-slate-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`,
            children: [
              /* @__PURE__ */ jsx(Icon, { size: 15, className: "shrink-0" }),
              /* @__PURE__ */ jsx("span", { className: "flex-1 text-left", children: item.label }),
              item.badge !== void 0 && /* @__PURE__ */ jsx(
                "span",
                {
                  className: `text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none
                    ${item.active ? "bg-indigo-500 text-indigo-100" : badgeColor}`,
                  children: item.badge
                }
              ),
              !item.badge && !item.active && isHov && /* @__PURE__ */ jsx(ChevronRight, { size: 12, className: "text-slate-400" })
            ]
          },
          item.label
        );
      })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "px-3 pb-5 pt-3 border-t border-slate-100 space-y-2", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 pb-1", children: "Quick Actions" }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onScanQR,
          className: "w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-medium text-sm transition-all shadow-sm shadow-indigo-300 active:scale-[.98]",
          children: [
            /* @__PURE__ */ jsx(QrCode, { size: 16 }),
            /* @__PURE__ */ jsx("span", { children: "Scan QR / Barcode" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onAddBook,
          className: "w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl font-medium text-sm transition-all active:scale-[.98]",
          children: [
            /* @__PURE__ */ jsx(PlusSquare, { size: 16, className: "text-indigo-500" }),
            /* @__PURE__ */ jsx("span", { children: "Add New Book" })
          ]
        }
      )
    ] })
  ] });
}
export {
  DashboardSidebar as default
};
