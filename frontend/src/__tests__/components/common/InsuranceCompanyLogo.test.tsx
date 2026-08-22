import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InsuranceCompanyLogo } from '../../../components/common/InsuranceCompanyLogo';

describe('InsuranceCompanyLogo', () => {
  it('falls back to the colored company label when no logo is configured', () => {
    render(<InsuranceCompanyLogo companyName="Альфа" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Альфа')).toBeInTheDocument();
  });

  it('renders a company logo in a neutral tile', () => {
    render(
      <InsuranceCompanyLogo companyName="Альфа" logoUrl="https://cdn.example.test/alfa.svg" />,
    );

    expect(screen.getByRole('img', { name: 'Логотип Альфа' })).toHaveAttribute(
      'src',
      'https://cdn.example.test/alfa.svg',
    );
  });

  it('falls back to the colored company label when the image fails to load', () => {
    render(
      <InsuranceCompanyLogo companyName="Альфа" logoUrl="https://cdn.example.test/alfa.svg" />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Логотип Альфа' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Альфа')).toBeInTheDocument();
  });
});
