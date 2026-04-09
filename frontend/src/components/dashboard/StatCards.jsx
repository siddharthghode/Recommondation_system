"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { BookOpen, BookCopy, DollarSign, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
function StatCards({ stats }) {
  const cards = [
    {
      label: "Total Books",
      value: stats.total_books.toLocaleString(),
      subLabel: "New this month",
      subValue: `+${stats.new_acquisitions_this_month}`,
      icon: BookOpen,
      color: "border-indigo-100",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      trend: { value: 1.3, positive: true }
    },
    {
      label: "Active Borrows",
      value: stats.active_borrows.toLocaleString(),
      subLabel: "Returned today",
      subValue: `+${stats.returned_today}`,
      icon: BookCopy,
      color: "border-violet-100",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      trend: { value: 4.1, positive: true }
    },
    {
      label: "Total Fines",
      value: `$${stats.total_fines_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      subLabel: "Overdue books",
      subValue: stats.overdue_count,
      icon: DollarSign,
      color: "border-amber-100",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      trend: { value: 0.8, positive: false }
    },
    {
      label: "Overdue Items",
      value: stats.overdue_count,
      subLabel: "Of active borrows",
      subValue: `${(stats.overdue_count / stats.active_borrows * 100).toFixed(1)}%`,
      icon: AlertCircle,
      color: "border-rose-100",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      trend: { value: 2.5, positive: false }
    },
    {
      label: "Returned Today",
      value: stats.returned_today,
      subLabel: "Pending re-shelf",
      subValue: Math.round(stats.returned_today * 0.35),
      icon: RefreshCw,
      color: "border-teal-100",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-600",
      trend: { value: 12, positive: true }
    },
    {
      label: "New Acquisitions",
      value: stats.new_acquisitions_this_month,
      subLabel: "Avg / week",
      subValue: `~${Math.round(stats.new_acquisitions_this_month / 4)}`,
      icon: Sparkles,
      color: "border-sky-100",
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      trend: { value: 8.4, positive: true }
    }
  ];
  return /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4", children: cards.map((card) => {
    const Icon = card.icon;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: `bg-white rounded-2xl border ${card.color} p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow`,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: `w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`, children: /* @__PURE__ */ jsx(Icon, { size: 17, className: card.iconColor }) }),
            card.trend && /* @__PURE__ */ jsxs(
              "span",
              {
                className: `text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                    ${card.trend.positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`,
                children: [
                  card.trend.positive ? "\u25B2" : "\u25BC",
                  " ",
                  card.trend.value,
                  "%"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-2xl font-extrabold text-slate-800 leading-none tracking-tight", children: card.value }),
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-slate-500 mt-1", children: card.label })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pt-1 border-t border-slate-50", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] text-slate-400", children: card.subLabel }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-600", children: card.subValue })
          ] })
        ]
      },
      card.label
    );
  }) });
}
export {
  StatCards as default
};
