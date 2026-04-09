"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { X, QrCode, PlusSquare, Camera, Search } from "lucide-react";
import { useState } from "react";
function ScanQRModal({ open, onClose }) {
  const [isbn, setIsbn] = useState("");
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/40 backdrop-blur-sm", onClick: onClose }),
    /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 border-b border-slate-100 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center", children: /* @__PURE__ */ jsx(QrCode, { size: 18, className: "text-indigo-600" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-800", children: "Scan QR / Barcode" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400", children: "Identify a book or member card" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500", children: /* @__PURE__ */ jsx(X, { size: 16 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "p-6 space-y-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/60" }),
          /* @__PURE__ */ jsx("div", { className: "absolute inset-6 border-2 border-indigo-400 rounded-lg opacity-70", children: [
            "top-0 left-0 border-t-2 border-l-2",
            "top-0 right-0 border-t-2 border-r-2",
            "bottom-0 left-0 border-b-2 border-l-2",
            "bottom-0 right-0 border-b-2 border-r-2"
          ].map((c, i) => /* @__PURE__ */ jsx("span", { className: `absolute w-4 h-4 border-indigo-400 ${c} rounded-sm` }, i)) }),
          /* @__PURE__ */ jsx("div", { className: "absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-[pulse_1.5s_ease-in-out_infinite]", style: { top: "40%" } }),
          /* @__PURE__ */ jsx(Camera, { size: 32, className: "text-slate-600 relative z-10" }),
          /* @__PURE__ */ jsx("p", { className: "absolute bottom-4 left-0 right-0 text-center text-[11px] text-slate-400", children: "Camera preview (device integration pending)" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-xs text-slate-400", children: [
          /* @__PURE__ */ jsx("div", { className: "flex-1 border-t border-slate-100" }),
          /* @__PURE__ */ jsx("span", { children: "or enter manually" }),
          /* @__PURE__ */ jsx("div", { className: "flex-1 border-t border-slate-100" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative flex-1", children: [
            /* @__PURE__ */ jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                value: isbn,
                onChange: (e) => setIsbn(e.target.value),
                type: "text",
                placeholder: "ISBN or Member ID",
                className: "w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("button", { className: "px-4 h-10 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition", children: "Look Up" })
        ] })
      ] })
    ] })
  ] });
}
function AddBookModal({ open, onClose, department }) {
  const [form, setForm] = useState({
    book_title: "",
    book_isbn: "",
    author_name: "",
    category_name: "",
    publication_year: "",
    copy_count: "1"
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/40 backdrop-blur-sm", onClick: onClose }),
    /* @__PURE__ */ jsxs("div", { className: "relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 border-b border-slate-100 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center", children: /* @__PURE__ */ jsx(PlusSquare, { size: 18, className: "text-emerald-600" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-800", children: "Add New Book" }),
            /* @__PURE__ */ jsxs("p", { className: "text-xs text-slate-400", children: [
              "Department: ",
              department
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500", children: /* @__PURE__ */ jsx(X, { size: 16 }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-6 grid grid-cols-2 gap-4", children: [
        { key: "book_title", label: "Book Title", placeholder: "e.g. Clean Code", span: true },
        { key: "book_isbn", label: "ISBN", placeholder: "978-0-000-00000-0", span: false },
        { key: "author_name", label: "Author", placeholder: "Author full name", span: false },
        { key: "category_name", label: "Category", placeholder: "e.g. Algorithms & DS", span: false },
        { key: "publication_year", label: "Publication Year", placeholder: "2024", span: false },
        { key: "copy_count", label: "Number of Copies", placeholder: "1", span: false }
      ].map(({ key, label, placeholder, span }) => /* @__PURE__ */ jsxs("div", { className: span ? "col-span-2" : "", children: [
        /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide", children: label }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: key === "publication_year" || key === "copy_count" ? "number" : "text",
            value: form[key],
            onChange: (e) => update(key, e.target.value),
            placeholder,
            className: "w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
          }
        )
      ] }, key)) }),
      /* @__PURE__ */ jsxs("div", { className: "px-6 pb-6 flex gap-3", children: [
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "flex-1 h-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition", children: "Cancel" }),
        /* @__PURE__ */ jsx("button", { className: "flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white transition", children: "Add to Catalogue" })
      ] })
    ] })
  ] });
}
export {
  AddBookModal,
  ScanQRModal
};
