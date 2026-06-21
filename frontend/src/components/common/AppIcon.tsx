import type { ReactElement, SVGProps } from 'react';

export type AppIconName =
  | 'dashboard'
  | 'deals'
  | 'clients'
  | 'policies'
  | 'finance'
  | 'tasks'
  | 'settings'
  | 'plus'
  | 'logout'
  | 'collapse'
  | 'expand'
  | 'close'
  | 'edit'
  | 'delete'
  | 'refresh'
  | 'search'
  | 'file'
  | 'upload'
  | 'check'
  | 'commands';

type AppIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: AppIconName;
  size?: number;
  title?: string;
};

const iconPaths: Record<AppIconName, ReactElement> = {
  dashboard: (
    <>
      <path d="M4 13.5a8 8 0 0 1 16 0" />
      <path d="M12 13.5 16.5 8" />
      <path d="M5 17h14" />
    </>
  ),
  deals: (
    <>
      <path d="M7 4h7l3 3v13H7z" />
      <path d="M14 4v4h4" />
      <path d="M9.5 12h5" />
      <path d="M9.5 15.5h4" />
    </>
  ),
  clients: (
    <>
      <path d="M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M20 19v-1a3 3 0 0 0-2.25-2.9" />
      <path d="M15.5 4.3a3 3 0 0 1 0 5.4" />
    </>
  ),
  policies: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </>
  ),
  finance: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5h-6a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H7.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 6h10" />
      <path d="M4 12h8" />
      <path d="M4 18h6" />
      <path d="m15 17 2 2 4-5" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.13a1.6 1.6 0 0 0-1-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.13A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.13a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.13A1.6 1.6 0 0 0 19.4 15Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M14 5h5v14h-5" />
    </>
  ),
  collapse: <path d="m14 7-5 5 5 5" />,
  expand: <path d="m10 7 5 5-5 5" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
      <path d="m14 7 3 3" />
    </>
  ),
  delete: (
    <>
      <path d="M5 7h14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M4 12A8 8 0 0 1 17.66 6.34" />
      <path d="M17.5 3.5v3h-3" />
      <path d="M6.5 20.5v-3h3" />
    </>
  ),
  search: (
    <>
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      <path d="m20 20-4-4" />
    </>
  ),
  file: (
    <>
      <path d="M7 4h7l3 3v13H7z" />
      <path d="M14 4v4h4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  check: <path d="m5 12 4 4 10-10" />,
  commands: (
    <>
      <path d="M9 6a3 3 0 1 0-3 3h3V6Z" />
      <path d="M15 9h3a3 3 0 1 0-3-3v3Z" />
      <path d="M9 15H6a3 3 0 1 0 3 3v-3Z" />
      <path d="M15 15v3a3 3 0 1 0 3-3h-3Z" />
      <path d="M9 9h6v6H9z" />
    </>
  ),
};

export function AppIcon({ name, size = 18, title, className = '', ...props }: AppIconProps) {
  const titleId = title ? `${name}-icon-title` : undefined;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      className={className}
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      {iconPaths[name]}
    </svg>
  );
}
