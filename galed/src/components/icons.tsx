import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconTrail = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20c3-1 4-4 7-5s6 0 7-3-1-5 2-8" />
    <circle cx="4" cy="20" r="1.4" fill="currentColor" />
    <path d="M18.5 3.5l2 .5-.5 2" />
  </svg>
);

export const IconCompass = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);

export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" strokeWidth="2.2" />
  </svg>
);

export const IconChat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5v7c0 1.4-1.1 2.5-2.5 2.5H10l-4.5 4v-4H6.5C5.1 16 4 14.9 4 13.5z" />
    <path d="M8.5 9h7M8.5 12h4.5" />
  </svg>
);

export const IconPack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 8a5 5 0 0110 0v11a1 1 0 01-1 1H8a1 1 0 01-1-1z" />
    <path d="M9.5 4.6V3.5h5v1.1M7 12h10M10 15.5h4" />
  </svg>
);

export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 5l7 7-7 7" strokeWidth="2" />
  </svg>
);

export const IconBookmark = ({ size, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size)} {...p}>
    <path d="M7 4h10v16l-5-3.5L7 20z" fill={filled ? "currentColor" : "none"} />
  </svg>
);

export const IconSend = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 4L9.5 14.5M20 4l-6.5 16-4-5.5L4 10.5z" />
  </svg>
);

export const IconPin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconCar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 15v-3l2-5h12l2 5v3a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
    <path d="M4 12h16" />
    <circle cx="7.5" cy="16.5" r="1.6" />
    <circle cx="16.5" cy="16.5" r="1.6" />
  </svg>
);

export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z" />
    <path d="M9 12l2 2 4-4.5" />
  </svg>
);

export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" strokeWidth="2.2" />
  </svg>
);

export const IconSliders = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

export const IconMoon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z" />
  </svg>
);

export const IconSun = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

export const IconUsers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <path d="M15.5 5.6a3.2 3.2 0 010 5.8M17.5 14.6c1.6.6 2.6 2 3 4.4" />
  </svg>
);
