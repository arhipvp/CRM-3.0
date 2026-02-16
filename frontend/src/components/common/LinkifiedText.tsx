import type { ReactNode } from 'react';
import { splitTextToLinks } from './linkifyText';

interface LinkifiedTextProps {
  text?: string | null;
  fallback?: ReactNode;
  className?: string;
  linkClassName?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  fallback = '—',
  className,
  linkClassName = 'text-blue-700 underline underline-offset-2 transition hover:text-blue-900',
}) => {
  if (!text) {
    return <>{fallback}</>;
  }

  const parts = splitTextToLinks(text);

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {part.value}
          </a>
        ) : (
          <span key={`text-${index}`} className={className}>
            {part.value}
          </span>
        ),
      )}
    </>
  );
};
