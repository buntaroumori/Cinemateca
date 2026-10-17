import type { SVGProps } from "react";

/**
 * Set de iconos propio: SVG inline de 1.4 px, rejilla de 24, corriente
 * heredada. Cero librerías de iconos = cero peso extra en el bundle.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconAperture(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v7.5" />
      <path d="m19.8 7.5-6.5 3.8" />
      <path d="m19.8 16.5-6.5-3.8" />
      <path d="M12 21v-7.5" />
      <path d="m4.2 16.5 6.5-3.8" />
      <path d="m4.2 7.5 6.5 3.8" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 3.8A1.6 1.6 0 0 1 11.2 3h1.6a1.6 1.6 0 0 1 1.6.8l.5.9c.2.3.5.5.8.6l1 .2c.7.1 1.2.7 1.3 1.4l.1 1.4a1.6 1.6 0 0 0 .5 1.1l.8.7c.5.5.7 1.3.4 2l-.5 1.3a1.7 1.7 0 0 1-1.5 1l-1 .1c-.3 0-.6.2-.8.5l-.5.9a1.6 1.6 0 0 1-1.6.8h-1.6a1.6 1.6 0 0 1-1.6-.8l-.5-.9a1.2 1.2 0 0 0-.8-.6l-1-.2a1.6 1.6 0 0 1-1.3-1.4l-.1-1.4a1.6 1.6 0 0 0-.5-1.1l-.8-.7a1.7 1.7 0 0 1-.4-2l.5-1.3a1.7 1.7 0 0 1 1.5-1l1-.1c.3 0 .6-.2.8-.5z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Svg>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </Svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 2.9-3.2 2.9H16a2 2 0 0 0-1.4 3.4c.4.5.4 1.2 0 1.7-.5.6-1.4 1-2.6 1z" />
      <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconGraph(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="4.6" cy="6.4" r="1.8" />
      <circle cx="19.4" cy="6.4" r="1.8" />
      <circle cx="4.6" cy="17.6" r="1.8" />
      <circle cx="19.4" cy="17.6" r="1.8" />
      <path d="m10 10.4-4-2.9M14 10.4l4-2.9M10 13.6l-4 2.9M14 13.6l4 2.9" />
    </Svg>
  );
}

export function IconFilm(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M16 4v16M3 12h18M3 8h5M3 16h5M16 8h5M16 16h5" />
    </Svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />
      <path d="M18.5 3.5v3M20 5h-3" />
    </Svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l10-6.5z" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 17v.2" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4.8h6V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </Svg>
  );
}

export function IconKey(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15.5 12v2.2" />
    </Svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function IconExpand(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </Svg>
  );
}

export function IconLoader(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4" opacity="0.95" />
      <path d="M12 17v4" opacity="0.35" />
      <path d="M3 12h4" opacity="0.55" />
      <path d="M17 12h4" opacity="0.75" />
      <path d="m5.6 5.6 2.8 2.8" opacity="0.45" />
      <path d="m15.6 15.6 2.8 2.8" opacity="0.85" />
      <path d="m18.4 5.6-2.8 2.8" opacity="0.65" />
      <path d="m8.4 15.6-2.8 2.8" opacity="0.25" />
    </Svg>
  );
}
