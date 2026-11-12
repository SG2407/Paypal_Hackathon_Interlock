import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { compileIntentMock } from '@/lib/ai/intent-compiler';
import { PolicyDisplay } from './policy-display';

describe('policy display', () => {
  afterEach(cleanup);

  it('shows the buyer the allowed brands before confirmation', () => {
    const policy = compileIntentMock('Headphones under $200').policy!;
    render(<PolicyDisplay policy={{ ...policy, requiredBrand: null, allowedBrands: ['Sony', 'Bose'] }} />);
    expect(screen.getByText('Allowed brands: Sony or Bose')).toBeInTheDocument();
  });
});
