import React from 'react';

import { ColoredLabel } from './ColoredLabel';

interface InsuranceCompanyLogoProps {
  companyName?: string | null;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export const InsuranceCompanyLogo: React.FC<InsuranceCompanyLogoProps> = ({
  companyName,
  logoUrl,
  className = '',
  fallbackClassName = '',
}) => {
  const [hasImageError, setHasImageError] = React.useState(false);

  React.useEffect(() => {
    setHasImageError(false);
  }, [logoUrl]);

  const name = companyName?.trim();
  if (!logoUrl?.trim() || hasImageError) {
    return (
      <ColoredLabel
        value={name}
        showDot
        className={`max-w-full truncate ${fallbackClassName}`.trim()}
      />
    );
  }

  return (
    <span
      className={`inline-flex h-8 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1 ${className}`.trim()}
    >
      <img
        src={logoUrl}
        alt={name ? `Логотип ${name}` : 'Логотип страховой компании'}
        className="h-full w-full object-contain"
        onError={() => setHasImageError(true)}
      />
    </span>
  );
};
