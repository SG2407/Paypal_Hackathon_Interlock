'use client';

import { CalendarClock, CircleDollarSign, PackageCheck, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCents } from '@/types/product';
import type { PermissionPolicy } from '@/types/policy';

export function PolicyDisplay({ policy, className }: { policy: PermissionPolicy; className?: string }) {
  const attributes = policy.requiredAttributes;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-700" />
          Confirmed purchase policy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <CircleDollarSign className="mt-0.5 h-5 w-5 text-green-700" />
          <div>
            <p className="text-sm text-gray-500">Maximum total</p>
            <p className="font-semibold">{formatCents(policy.maxBudgetCents, policy.currency)}</p>
            <p className="text-xs text-gray-500">
              Shipping {policy.budgetIncludesShipping ? 'included' : 'excluded'} · tax {policy.budgetIncludesTax ? 'included' : 'excluded'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <PackageCheck className="mt-0.5 h-5 w-5 text-blue-700" />
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Product constraints</p>
            <p className="font-medium capitalize">{policy.productCategory}{policy.requiredBrand ? ` · ${policy.requiredBrand}` : ''}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="info">{policy.allowedCondition}</Badge>
              {attributes.map(({ attribute, value }) => (
                <Badge key={attribute} variant="default">{attribute}: {value}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <p className="text-sm text-gray-500">Delivery & quantity</p>
            <p className="font-medium">
              {policy.deliveryDeadline
                ? new Date(policy.deliveryDeadline).toLocaleDateString()
                : 'No deadline specified'} · {policy.minQuantity}-{policy.maxQuantity} item(s)
            </p>
          </div>
        </div>
        <div className="border-t pt-4 text-sm text-gray-700">
          <p>Subscriptions: <strong>{policy.allowSubscriptions ? 'allowed' : 'not allowed'}</strong></p>
          <p>Add-ons: <strong>{policy.allowAddOns ? 'allowed' : 'not allowed'}</strong></p>
          <p>Substitutions: <strong>{policy.allowSubstitutions ? 'review required' : 'not allowed'}</strong></p>
          <p>Buyer approval: <strong>{policy.requireHumanApproval ? 'required' : 'not required'}</strong></p>
          {policy.approvedProducts.length > 0 && (
            <p className="mt-2 text-amber-800">
              Product-specific exceptions: <strong>{policy.approvedProducts.length} buyer-confirmed</strong>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
