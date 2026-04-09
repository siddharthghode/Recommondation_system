"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from "recharts";
const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#7c3aed", "#4f46e5"];
const CustomTooltip = ({
  active,
  payload,
  label
}) => {
  if (!active || !payload?.length) return null;
  return /* @__PURE__ */ jsxs("div", { className: "bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs", children: [
    /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800 mb-1.5", children: label }),
    payload.map((p) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 py-0.5", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full", style: { background: p.color } }),
      /* @__PURE__ */ jsxs("span", { className: "text-slate-500 capitalize", children: [
        p.name.replace("_", " "),
        ":"
      ] }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: p.value })
    ] }, p.name))
  ] });
};
function TopCategoriesChart({ data }) {
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-full", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold text-slate-800", children: "Top Categories" }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Borrow count vs. available stock by category" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 min-h-0", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(
      BarChart,
      {
        data,
        margin: { top: 4, right: 4, left: -20, bottom: 0 },
        barCategoryGap: "30%",
        barGap: 3,
        children: [
          /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9", vertical: false }),
          /* @__PURE__ */ jsx(
            XAxis,
            {
              dataKey: "category_name",
              tick: { fontSize: 10, fill: "#94a3b8" },
              axisLine: false,
              tickLine: false,
              interval: 0,
              angle: -20,
              textAnchor: "end",
              height: 44
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
          /* @__PURE__ */ jsx(Tooltip, { content: /* @__PURE__ */ jsx(CustomTooltip, {}), cursor: { fill: "#f8fafc" } }),
          /* @__PURE__ */ jsx(
            Legend,
            {
              iconType: "circle",
              iconSize: 8,
              wrapperStyle: { fontSize: 11, paddingTop: 12 },
              formatter: (v) => /* @__PURE__ */ jsx("span", { className: "text-slate-500 capitalize", children: String(v).replace("_", " ") })
            }
          ),
          /* @__PURE__ */ jsx(Bar, { dataKey: "borrow_count", name: "borrow_count", radius: [4, 4, 0, 0], children: data.map((_, i) => /* @__PURE__ */ jsx(Cell, { fill: COLORS[i % COLORS.length] }, i)) }),
          /* @__PURE__ */ jsx(Bar, { dataKey: "available_count", name: "available_count", fill: "#e2e8f0", radius: [4, 4, 0, 0] })
        ]
      }
    ) }) })
  ] });
}
export {
  TopCategoriesChart as default
};
