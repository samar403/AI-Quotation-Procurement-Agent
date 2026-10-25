import type { SVGProps } from "react";

// Hand-tuned 20px line icons (1.6 stroke) so the app has no icon-font dependency.
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 18, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Icon = {
  Loom: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 3v14M17 3v14M3 5h14M3 15h14M7 5v10M10 5v10M13 5v10" />
      <path d="M5 9h10" strokeWidth={2.4} opacity={0.5} />
    </svg>
  ),
  Inbox: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 11l2-7h10l2 7v5H3v-5z" />
      <path d="M3 11h4l1 2h4l1-2h4" />
    </svg>
  ),
  Spool: (p: P) => (
    <svg {...base(p)}>
      <path d="M5 3h10M5 17h10M6.5 3c0 4 7 3 7 7s-7 3-7 7" />
      <path d="M13.5 3c0 4-7 3-7 7s7 3 7 7" opacity={0.5} />
    </svg>
  ),
  Receipt: (p: P) => (
    <svg {...base(p)}>
      <path d="M5 2.5h10v15l-2-1.3-1.7 1.3-1.6-1.3-1.7 1.3L6.3 16.2 5 17.5v-15z" />
      <path d="M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" />
    </svg>
  ),
  Mill: (p: P) => (
    <svg {...base(p)}>
      <path d="M2.5 17V9l4 2.5V9l4 2.5V9l4 2.5V4h3v13h-15z" />
      <path d="M6 14h1M10 14h1M14 14h1" />
    </svg>
  ),
  Gear: (p: P) => (
    <svg {...base(p)}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7" />
    </svg>
  ),
  Upload: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13.5v3h13v-3" />
    </svg>
  ),
  Chat: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 3a7 7 0 00-6.1 10.4L3 17l3.7-.9A7 7 0 1010 3z" />
      <path d="M7.5 8.5c.3 1.7 2.2 3.6 4 4l1-1-1.5-.8-.6.6c-.8-.3-1.4-.9-1.7-1.7l.6-.6-.8-1.5-1 1z" strokeWidth={1.1} />
    </svg>
  ),
  Mail: (p: P) => (
    <svg {...base(p)}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="M3 5.5l7 5 7-5" />
    </svg>
  ),
  Pdf: (p: P) => (
    <svg {...base(p)}>
      <path d="M5 2.5h7l3.5 3.5v11.5H5v-15z" />
      <path d="M12 2.5V6h3.5M7.5 11h5M7.5 14h3.5" />
    </svg>
  ),
  Image: (p: P) => (
    <svg {...base(p)}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <circle cx="7" cy="8" r="1.5" />
      <path d="M3 15l4.5-4 3 2.5 2.5-2 4 3.5" />
    </svg>
  ),
  Check: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  ),
  X: (p: P) => (
    <svg {...base(p)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  ),
  Arrow: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  ),
  Spark: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  ),
  Search: (p: P) => (
    <svg {...base(p)}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  ),
  Moon: (p: P) => (
    <svg {...base(p)}>
      <path d="M16 12.5A6.5 6.5 0 017.5 4a6.5 6.5 0 108.5 8.5z" />
    </svg>
  ),
  Sun: (p: P) => (
    <svg {...base(p)}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1" />
    </svg>
  ),
  Menu: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  ),
  Download: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 3.5V13M6 9l4 4 4-4M3.5 13.5v3h13v-3" />
    </svg>
  ),
  Copy: (p: P) => (
    <svg {...base(p)}>
      <rect x="6.5" y="6.5" width="10" height="10" rx="2" />
      <path d="M13.5 6.5v-3h-10v10h3" />
    </svg>
  ),
  Send: (p: P) => (
    <svg {...base(p)}>
      <path d="M17.5 2.5L2.5 9l6 2.5L11 17.5l6.5-15zM8.5 11.5l3.5-3.5" />
    </svg>
  ),
  Trophy: (p: P) => (
    <svg {...base(p)}>
      <path d="M6.5 3h7v4a3.5 3.5 0 01-7 0V3zM6.5 4.5H4a2.5 2.5 0 003 2.4M13.5 4.5H16a2.5 2.5 0 01-3 2.4M10 10.5V14M7 17h6M8 14h4v3H8z" />
    </svg>
  ),
  Edit: (p: P) => (
    <svg {...base(p)}>
      <path d="M13.5 3.5l3 3-9 9H4.5v-3l9-9z" />
    </svg>
  ),
  Plus: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  ),
  Trash: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6" />
    </svg>
  ),
  Alert: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 3l8 14H2l8-14zM10 8.5v3.5M10 14.5v.1" />
    </svg>
  ),
  Clock: (p: P) => (
    <svg {...base(p)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </svg>
  ),
};
