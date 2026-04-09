"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Bookmark,
  Clock,
  Filter
} from "lucide-react";
import { useState } from "react";
const EVENT_CONFIG = {
  checkout: {
    label: "Checkout",
    icon: ArrowUpRight,
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    dot: "bg-indigo-500"
  },
  return: {
    label: "Return",
    icon: ArrowDownLeft,
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    dot: "bg-emerald-500"
  },
  renewal: {
    label: "Renewal",
    icon: RefreshCw,
    bg: "bg-violet-50",
    text: "text-violet-600",
    dot: "bg-violet-500"
  },
  fine_issued: {
    label: "Fine",
    icon: AlertTriangle,
    bg: "bg-amber-50",
    text: "text-amber-600",
    dot: "bg-amber-500"
  },
  reservation: {
    label: "Reserved",
    icon: Bookmark,
    bg: "bg-sky-50",
    text: "text-sky-600",
    dot: "bg-sky-500"
  }
};
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const FILTERS = [
  { key: "all", label: "All" },
  { key: "checkout", label: "Checkouts" },
  { key: "return", label: "Returns" },
  { key: "fine_issued", label: "Fines" },
  { key: "renewal", label: "Renewals" }
];
function ActivityFeed({ items }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const filtered = activeFilter === "all" ? items : items.filter((i) => i.event_type === activeFilter);
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "px-5 pt-5 pb-3 border-b border-slate-50 shrink-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold text-slate-800", children: "Activity Feed" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Real-time library events" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "w-2 h-2 bg-emerald-400 rounded-full animate-pulse" }),
          /* @__PURE__ */ jsx("span", { className: "text-[11px] text-emerald-600 font-medium", children: "Live" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-0.5", children: [
        /* @__PURE__ */ jsx(Filter, { size: 11, className: "text-slate-400 shrink-0 mr-0.5" }),
        FILTERS.map((f) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setActiveFilter(f.key),
            className: `shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition
                ${activeFilter === f.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`,
            children: f.label
          },
          f.key
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto divide-y divide-slate-50", children: filtered.map((item, idx) => {
      const type = item.event_type || "checkout";
      const cfg = EVENT_CONFIG[type] || EVENT_CONFIG["checkout"];
      const Icon = cfg.icon;
      const title = item.book_title || item.title || "Unknown Book";
      const member = item.member_name || item.user__username || "Library Member";
      const mId = item.member_id || item.user_id || "N/A";
      const stamp = item.timestamp || item.requested_at || new Date().toISOString();
      return /* @__PURE__ */ jsx(
        "div",
        {
          className: "px-5 py-3.5 hover:bg-slate-50/60 transition group",
          children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: `w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`, children: /* @__PURE__ */ jsx(Icon, { size: 14, className: cfg.text }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-slate-800 truncate leading-tight", children: title }),
                /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 shrink-0", children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`,
                    children: cfg.label
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3 mt-1", children: /* @__PURE__ */ jsxs("span", { className: "text-[11px] text-slate-500 truncate", children: [
                member,
                /* @__PURE__ */ jsx("span", { className: "text-slate-300 mx-1", children: "\xB7" }),
                /* @__PURE__ */ jsx("span", { className: "font-mono", children: mId })
              ] }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mt-1.5", children: [
                item.due_date && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 text-[10px] text-slate-400", children: [
                  /* @__PURE__ */ jsx(Clock, { size: 10 }),
                  "Due ",
                  new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                ] }),
                item.fine_amount && /* @__PURE__ */ jsxs("span", { className: "text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full", children: [
                  "$",
                  item.fine_amount.toFixed(2),
                  " fine"
                ] }),
                /* @__PURE__ */ jsx("span", { className: "ml-auto text-[10px] text-slate-400", children: timeAgo(stamp) })
              ] })
            ] })
          ] })
        },
        item.id
      );
    }) }),
    /* @__PURE__ */ jsx("div", { className: "px-5 py-3 border-t border-slate-50 shrink-0", children: /* @__PURE__ */ jsx("button", { className: "w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium transition text-center", children: "View full transaction log \u2192" }) })
  ] });
}
export {
  ActivityFeed as default
};
