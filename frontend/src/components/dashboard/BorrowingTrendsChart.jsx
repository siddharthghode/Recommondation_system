"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  AreaChart
} from "recharts";
import { useState } from "react";
const CustomTooltip = ({
  active,
  payload,
  label
}) => {
  if (!active || !payload?.length) return null;
  return /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs", children: [
    /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-700 mb-2", children: label }),
    payload.map((p) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 py-0.5", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full", style: { background: p.color } }),
      /* @__PURE__ */ jsxs("span", { className: "text-slate-500 capitalize", children: [
        p.name,
        ":"
      ] }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: p.value })
    ] }, p.name))
  ] });
};
function BorrowingTrendsChart({ data }) {
  const [view, setView] = useState("area");
  const avg = Math.round(data.reduce((s, d) => s + d.checkouts, 0) / data.length);
  const ChartComponent = view === "area" ? AreaChart : LineChart;
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-full", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between mb-5", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold text-slate-800", children: "Borrowing Trends" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Last 30 days \u2014 checkouts, returns & renewals" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 bg-slate-100 rounded-lg p-0.5", children: ["area", "line"].map((v) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setView(v),
          className: `text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition
                ${view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`,
          children: v
        },
        v
      )) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3 mb-4 flex-wrap", children: [
      { label: "Avg Checkouts/day", value: avg, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Peak", value: Math.max(...data.map((d) => d.checkouts)), color: "text-violet-600", bg: "bg-violet-50" },
      { label: "Total Returns", value: data.reduce((s, d) => s + d.returns, 0), color: "text-emerald-600", bg: "bg-emerald-50" }
    ].map((pill) => /* @__PURE__ */ jsxs("div", { className: `flex items-center gap-2 px-3 py-1.5 rounded-full ${pill.bg}`, children: [
      /* @__PURE__ */ jsx("span", { className: `text-sm font-bold ${pill.color}`, children: pill.value }),
      /* @__PURE__ */ jsx("span", { className: "text-[11px] text-slate-500", children: pill.label })
    ] }, pill.label)) }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 min-h-0", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(ChartComponent, { data, margin: { top: 4, right: 4, left: -20, bottom: 0 }, children: [
      /* @__PURE__ */ jsxs("defs", { children: [
        /* @__PURE__ */ jsxs("linearGradient", { id: "gradCheckouts", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "5%", stopColor: "#6366f1", stopOpacity: 0.18 }),
          /* @__PURE__ */ jsx("stop", { offset: "95%", stopColor: "#6366f1", stopOpacity: 0 })
        ] }),
        /* @__PURE__ */ jsxs("linearGradient", { id: "gradReturns", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsx("stop", { offset: "5%", stopColor: "#10b981", stopOpacity: 0.12 }),
          /* @__PURE__ */ jsx("stop", { offset: "95%", stopColor: "#10b981", stopOpacity: 0 })
        ] })
      ] }),
      /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9", vertical: false }),
      /* @__PURE__ */ jsx(
        XAxis,
        {
          dataKey: "date",
          tick: { fontSize: 10, fill: "#94a3b8" },
          axisLine: false,
          tickLine: false,
          interval: 4
        }
      ),
      /* @__PURE__ */ jsx(
        YAxis,
        {
          tick: { fontSize: 10, fill: "#94a3b8" },
          axisLine: false,
          tickLine: false
        }
      ),
      /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(CustomTooltip, {}) }),
      /* @__PURE__ */ jsx(ReferenceLine, { y: avg, stroke: "#6366f1", strokeDasharray: "4 4", strokeOpacity: 0.4 }),
      /* @__PURE__ */ jsx(
        Legend,
        {
          iconType: "circle",
          iconSize: 8,
          wrapperStyle: { fontSize: 11, paddingTop: 10 },
          formatter: (v) => /* @__PURE__ */ jsx("span", { className: "text-slate-500 capitalize", children: v })
        }
      ),
      view === "area" ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          Area,
          {
            type: "monotone",
            dataKey: "checkouts",
            stroke: "#6366f1",
            strokeWidth: 2,
            fill: "url(#gradCheckouts)",
            dot: false,
            activeDot: { r: 4, fill: "#6366f1" }
          }
        ),
        /* @__PURE__ */ jsx(
          Area,
          {
            type: "monotone",
            dataKey: "returns",
            stroke: "#10b981",
            strokeWidth: 2,
            fill: "url(#gradReturns)",
            dot: false,
            activeDot: { r: 4, fill: "#10b981" }
          }
        ),
        /* @__PURE__ */ jsx(
          Area,
          {
            type: "monotone",
            dataKey: "renewals",
            stroke: "#f59e0b",
            strokeWidth: 1.5,
            fill: "none",
            dot: false,
            strokeDasharray: "4 3",
            activeDot: { r: 3, fill: "#f59e0b" }
          }
        )
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "checkouts", stroke: "#6366f1", strokeWidth: 2, dot: false, activeDot: { r: 4 } }),
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "returns", stroke: "#10b981", strokeWidth: 2, dot: false, activeDot: { r: 4 } }),
        /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "renewals", stroke: "#f59e0b", strokeWidth: 1.5, dot: false, strokeDasharray: "4 3" })
      ] })
    ] }) }) })
  ] });
}
export {
  BorrowingTrendsChart as default
};
