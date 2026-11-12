'use client';

import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle, Clock, FileText, Loader2, Hash, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { formatCurrency, formatDate, truncateHash } from '@/lib/utils';
import type { AuditVerification } from '@/types/audit';

interface AuditRecord {
  id: string;
  type: string;
  timestamp: string;
  missionId: string;
  data: {
    intent?: string;
    policy?: Record<string, unknown>;
    productName?: string;
    amount?: number;
    currency?: string;
    decision?: 'PASS' | 'BLOCK' | 'REVIEW';
    orderId?: string;
    paypalOrderId?: string;
    captureId?: string;
    hash?: string;
    previousHash?: string | null;
  };
}

export default function HistoryPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/audit/history');
        if (response.ok) {
          const data = await response.json();
          setRecords(data.records || []);
          setVerification(data.verification || null);
        } else {
          setError('Failed to load audit history.');
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
        setError('Failed to load audit history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const verifyHashChain = async () => {
    setVerificationLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/audit/history?verify=1');
      const data = await response.json();
      if (!response.ok || !data.verification) throw new Error(data.error || 'Audit verification failed.');
      setVerification(data.verification);
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Audit verification failed.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mission_created':
      case 'policy_confirmed':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'products_recommended':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'order_created':
      case 'order_approved':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'order_captured':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'tampering_detected':
      case 'order_blocked':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'validation_failed':
        return <Hash className="h-5 w-5 text-purple-500" />;
      default:
        return <History className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'mission_created':
        return <Badge variant="info">Mission Created</Badge>;
      case 'policy_confirmed':
        return <Badge variant="info">Policy Confirmed</Badge>;
      case 'products_recommended':
        return <Badge variant="success">Recommendations Ready</Badge>;
      case 'order_created':
        return <Badge variant="warning">Order Created</Badge>;
      case 'order_approved':
        return <Badge variant="warning">Buyer Approved</Badge>;
      case 'order_captured':
        return <Badge variant="success">Payment Captured</Badge>;
      case 'order_blocked':
        return <Badge variant="danger">Order Blocked</Badge>;
      case 'tampering_detected':
        return <Badge variant="danger">Integrity Alert</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const getDecisionBadge = (decision?: 'PASS' | 'BLOCK' | 'REVIEW') => {
    switch (decision) {
      case 'PASS':
        return <Badge variant="success">Authorized</Badge>;
      case 'BLOCK':
        return <Badge variant="danger">Blocked</Badge>;
      case 'REVIEW':
        return <Badge variant="warning">Review Required</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
        <p className="mt-1 text-gray-500">
          Cryptographically verified audit trail of all your shopping missions
        </p>
      </div>
      {error && <Card className="mb-6 border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-800">{error}</CardContent></Card>}
      {verification && (
        <Card className={`mb-6 ${verification.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="flex items-center gap-3 p-4">
            {verification.valid
              ? <ShieldCheck className="h-5 w-5 text-green-700" />
              : <XCircle className="h-5 w-5 text-red-700" />}
            <p className={verification.valid ? 'text-green-800' : 'text-red-800'}>
              {verification.valid
                ? `Audit chain verified (${verification.verifiedEvents}/${verification.totalEvents} events).`
                : `Audit chain failed at event ${verification.brokenAt ?? 'unknown'}.`}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Records List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No history yet</h3>
                <p className="mt-2 text-gray-500">
                  Your transaction history will appear here after completing purchases.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <Card
                  key={record.id}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    selectedRecord?.id === record.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedRecord(record)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                        {getTypeIcon(record.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(record.type)}
                          {record.data.decision && getDecisionBadge(record.data.decision)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(record.timestamp)}
                        </p>
                        {record.data.productName && (
                          <p className="mt-1 font-medium text-gray-900">{record.data.productName}</p>
                        )}
                        {record.data.intent && (
                          <p className="mt-1 text-sm text-gray-600 truncate">{record.data.intent}</p>
                        )}
                        {record.data.amount !== undefined && (
                          <p className="mt-1 text-sm font-semibold text-blue-600">
                            {formatCurrency(record.data.amount, record.data.currency || 'USD')}
                          </p>
                        )}
                        {record.data.hash && (
                          <p className="mt-1 text-xs font-mono text-gray-400">
                            Hash: {truncateHash(record.data.hash)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Record Detail */}
        <div>
          {selectedRecord ? (
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Audit Record Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Event Type</p>
                  {getTypeBadge(selectedRecord.type)}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Timestamp</p>
                  <p className="text-sm">{formatDate(selectedRecord.timestamp)}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Mission ID</p>
                  <p className="text-sm font-mono">{selectedRecord.missionId}</p>
                </div>

                {selectedRecord.data.hash && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Hash</p>
                    <p className="text-xs font-mono break-all text-gray-600">
                      {selectedRecord.data.hash}
                    </p>
                  </div>
                )}

                {selectedRecord.data.previousHash && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Previous Hash</p>
                    <p className="text-xs font-mono break-all text-gray-400">
                      {selectedRecord.data.previousHash}
                    </p>
                  </div>
                )}

                {selectedRecord.data.decision && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Decision</p>
                    {getDecisionBadge(selectedRecord.data.decision)}
                  </div>
                )}

                {(selectedRecord.data.paypalOrderId || selectedRecord.data.orderId) && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">PayPal Order ID</p>
                    <p className="text-sm font-mono break-all">{selectedRecord.data.paypalOrderId || selectedRecord.data.orderId}</p>
                  </div>
                )}
                {selectedRecord.data.captureId && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">PayPal Capture ID</p>
                    <p className="text-sm font-mono break-all">{selectedRecord.data.captureId}</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button variant="outline" size="sm" className="w-full" onClick={verifyHashChain} disabled={verificationLoading}>
                    {verificationLoading ? 'Verifying…' : 'Verify Hash Chain'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Select a record to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
