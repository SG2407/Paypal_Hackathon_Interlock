'use client';

import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { PolicyEvaluation } from '@/types/policy';

export function ValidationResultDisplay({ result, className }: { result: PolicyEvaluation; className?: string }) {
  const config = {
    PASS: { Icon: CheckCircle2, label: 'PASS', variant: 'success' as const, description: 'Every mandatory policy check passed.' },
    REVIEW: { Icon: AlertTriangle, label: 'REVIEW', variant: 'warning' as const, description: 'Additional buyer permission is required before checkout.' },
    BLOCK: { Icon: ShieldAlert, label: 'BLOCK', variant: 'danger' as const, description: 'A mandatory policy constraint failed. Checkout is disabled.' },
  }[result.decision];
  const Icon = config.Icon;

  return (
    <Card className={className}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />Deterministic policy evaluation</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
          <Badge variant={config.variant}>{config.label}</Badge>
          <p className="text-sm text-gray-700">{config.description}</p>
        </div>
        <ul className="space-y-3">
          {result.checks.map((check, index) => (
            <li key={`${check.checkName}-${index}`} className="flex gap-2 text-sm">
              {check.decision === 'PASS'
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                : check.decision === 'REVIEW'
                  ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
              <div>
                <p className="font-medium capitalize">{check.checkName.replaceAll('_', ' ')}</p>
                <p className="text-gray-600">{check.explanation}</p>
                {(check.expected !== null || check.actual !== null) && (
                  <p className="mt-0.5 text-xs text-gray-500">Expected: {check.expected ?? '—'} · Actual: {check.actual ?? 'unknown'}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
