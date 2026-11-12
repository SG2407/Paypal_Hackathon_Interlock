'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@/components/ui';
import { formatCents, type Product } from '@/types/product';
import type { PolicyDecision } from '@/types/policy';

interface ProductCardProps {
  product: Product;
  decision: PolicyDecision;
  explanation?: string;
  aiExplanation?: string;
  onSelect?: () => void;
  selected?: boolean;
}

const decisionStyles: Record<PolicyDecision, { label: string; variant: 'success' | 'warning' | 'danger'; Icon: typeof CheckCircle2 }> = {
  PASS: { label: 'PASS', variant: 'success', Icon: CheckCircle2 },
  REVIEW: { label: 'REVIEW', variant: 'warning', Icon: AlertTriangle },
  BLOCK: { label: 'BLOCK', variant: 'danger', Icon: XCircle },
};

export function ProductCard({ product, decision, explanation, aiExplanation, onSelect, selected }: ProductCardProps) {
  const { label, variant, Icon } = decisionStyles[decision];
  const total = product.priceCents + product.shippingCents + product.taxEstimateCents;

  return (
    <Card className={`overflow-hidden ${selected ? 'ring-2 ring-blue-600' : ''}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{product.brand} · {product.condition}</p>
            <h3 className="mt-1 font-semibold text-gray-900">{product.name}</h3>
          </div>
          <Badge variant={variant}><Icon className="mr-1 h-3.5 w-3.5" />{label}</Badge>
        </div>
        <p className="text-sm text-gray-600">{product.description}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <dt className="text-gray-500">Item</dt><dd className="text-right">{formatCents(product.priceCents, product.currency)}</dd>
          <dt className="text-gray-500">Shipping</dt><dd className="text-right">{formatCents(product.shippingCents, product.currency)}</dd>
          <dt className="text-gray-500">Demo tax</dt><dd className="text-right">{formatCents(product.taxEstimateCents, product.currency)}</dd>
          <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{formatCents(total, product.currency)}</dd>
        </dl>
        <p className="text-xs text-gray-500">
          {product.merchantName} · estimated {new Date(product.deliveryDate).toLocaleDateString()}
          {product.hasSubscription ? ' · subscription included' : ''}
        </p>
        {explanation && <p className={`text-sm ${decision === 'BLOCK' ? 'text-red-700' : decision === 'REVIEW' ? 'text-amber-800' : 'text-green-800'}`}>{explanation}</p>}
        {aiExplanation && <p className="border-t pt-2 text-xs text-gray-500"><strong>AI recommendation:</strong> {aiExplanation}</p>}
        {onSelect && (
          <Button className="w-full" variant={selected ? 'primary' : 'outline'} disabled={decision !== 'PASS'} onClick={onSelect}>
            {decision === 'PASS' ? (selected ? 'Selected' : 'Select for checkout') : 'Checkout unavailable'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
