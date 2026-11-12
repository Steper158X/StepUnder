import { createUniqueId } from "solid-js";

/** Hue-shifted brand color; `--brand-h` follows the accent picked in settings. */
const brand = (l: number, c: number, shift = 0, alpha?: number) =>
  `oklch(${l} ${c} calc(var(--brand-h) + ${shift})${alpha === undefined ? "" : ` / ${alpha}`})`;

/**
 * The StepUnder mark drawn inline so its colors track the accent. Mirrors
 * `assets/logo.svg`, which stays as the static purple file for the app icon.
 */
export function Logo(props: { class?: string }) {
  // Each instance needs its own gradient ids: a hidden copy would otherwise
  // break the gradients of every visible one that points at it.
  const id = createUniqueId();
  const bg = `su-bg-${id}`;
  const glow = `su-glow-${id}`;
  const bar = `su-bar-${id}`;
  const under = `su-under-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      class={props.class}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={bg}
          x1="96"
          y1="0"
          x2="928"
          y2="1024"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ "stop-color": brand(0.3, 0.122, 1.5) }} />
          <stop offset="0.55" style={{ "stop-color": brand(0.197, 0.075) }} />
          <stop offset="1" style={{ "stop-color": brand(0.139, 0.042, 3.7) }} />
        </linearGradient>
        <radialGradient
          id={glow}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(352 224) rotate(54) scale(700)"
        >
          <stop
            offset="0"
            style={{ "stop-color": brand(0.627, 0.233, 11, 0.6) }}
          />
          <stop
            offset="1"
            style={{ "stop-color": brand(0.627, 0.233, 11, 0) }}
          />
        </radialGradient>
        <linearGradient
          id={bar}
          x1="512"
          y1="284"
          x2="512"
          y2="624"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" style={{ "stop-color": brand(0.96, 0.022, 4.4) }} />
        </linearGradient>
        <linearGradient
          id={under}
          x1="236"
          y1="652"
          x2="788"
          y2="652"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            style={{ "stop-color": brand(0.827, 0.108, 13.4) }}
          />
          <stop
            offset="0.5"
            style={{ "stop-color": brand(0.627, 0.233, 11) }}
          />
          <stop offset="1" style={{ "stop-color": brand(0.541, 0.247) }} />
        </linearGradient>
      </defs>

      <rect width="1024" height="1024" rx="224" fill={`url(#${bg})`} />
      <rect width="1024" height="1024" rx="224" fill={`url(#${glow})`} />
      <rect
        x="5"
        y="5"
        width="1014"
        height="1014"
        rx="219"
        fill="none"
        stroke="#ffffff"
        stroke-opacity="0.08"
        stroke-width="10"
      />

      {/* Stepped equaliser: each bar is one step down */}
      <g fill={`url(#${bar})`}>
        <rect x="250" y="284" width="92" height="340" rx="46" />
        <rect x="394" y="356" width="92" height="268" rx="46" />
        <rect x="538" y="428" width="92" height="196" rx="46" />
        <rect x="682" y="500" width="92" height="124" rx="46" opacity="0.94" />
      </g>

      {/* The "under" line: a soft wave carrying the steps */}
      <path
        d="M236 652Q512 768 788 652"
        fill="none"
        stroke={`url(#${under})`}
        stroke-width="60"
        stroke-linecap="round"
      />
    </svg>
  );
}
