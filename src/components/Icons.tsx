import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  ...props,
});

export const MicIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
  </svg>
);

export const MicOffIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3.27 3 2 4.27l6 6V11a3 3 0 0 0 3 3c.13 0 .26-.01.39-.03l1.74 1.74A4.9 4.9 0 0 1 12 16a5 5 0 0 1-5-5H5a7 7 0 0 0 6 6.92V21h2v-3.08c.71-.1 1.39-.31 2-.62L19.73 21 21 19.73 3.27 3ZM15 11.16V5a3 3 0 0 0-5.94-.6L15 11.16Z" />
  </svg>
);

export const VideoIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
  </svg>
);

export const VideoOffIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5ZM3.27 2 2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 .73-.32L19.73 21 21 19.73 3.27 2Z" />
  </svg>
);

export const ScreenShareIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5v2h6v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 13H4V5h16v11Zm-9-2 4-3-4-3v6Z" />
  </svg>
);

export const StopShareIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h5v2h6v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 13H4V5h16v11ZM9 8h6v6H9V8Z" />
  </svg>
);

export const ChatIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 12H6v-2h12v2Zm0-3H6V9h12v2Zm0-3H6V6h12v2Z" />
  </svg>
);

export const PeopleIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
  </svg>
);

export const PhoneOffIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.01L.29 13.08a1 1 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.48a1 1 0 0 1-1.41.01 11.9 11.9 0 0 0-2.66-1.85.998.998 0 0 1-.56-.9v-3.1A15.6 15.6 0 0 0 12 9Z" />
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
  </svg>
);

export const SendIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2 .01 7Z" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" />
  </svg>
);

export const VideoCallIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4ZM12 13H9v3H7v-3H4v-2h3V8h2v3h3v2Z" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8Z" />
  </svg>
);

export const PinIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5c0 1.66-1.34 3-3 3v2h5.97v6l1 1 1-1v-6H19v-2c-1.66 0-3-1.34-3-3Z" />
  </svg>
);
