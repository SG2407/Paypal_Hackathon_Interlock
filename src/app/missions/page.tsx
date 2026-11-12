'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Shield, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { formatCents } from '@/types/product';
import type { PermissionPolicy } from '@/types/policy';

interface Mission {
  id: string;
  intent: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  policy: Pick<PermissionPolicy, 'maxBudgetCents' | 'currency' | 'productCategory'> | null;
  createdAt: string;
  productName?: string;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch missions from API
    const fetchMissions = async () => {
      try {
        const response = await fetch('/api/missions');
        if (response.ok) {
          const data = await response.json();
          setMissions(data.missions || []);
        }
      } catch (error) {
        console.error('Failed to fetch missions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, []);

  const getStatusBadge = (status: Mission['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'active':
        return <Badge variant="info">Active</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
    }
  };

  const getStatusIcon = (status: Mission['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'active':
        return <Shield className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shopping Missions</h1>
          <p className="mt-1 text-gray-500">
            Your intent-protected shopping sessions
          </p>
        </div>
        <Link href="/missions/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Mission
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : missions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No missions yet</h3>
            <p className="mt-2 text-gray-500">
              Create your first shopping mission to get started with intent-protected purchases.
            </p>
            <Link href="/missions/new" className="mt-6 inline-block">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Mission
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {missions.map((mission) => (
            <Link key={mission.id} href={`/missions/${mission.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      {getStatusIcon(mission.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(mission.status)}
                        <span className="text-sm text-gray-500">
                          {formatDate(mission.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium truncate">
                        {mission.intent}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Budget: {mission.policy ? formatCents(mission.policy.maxBudgetCents, mission.policy.currency) : 'Not set'}
                        </span>
                        {mission.policy?.productCategory && (
                          <span>
                            Category: {mission.policy.productCategory}
                          </span>
                        )}
                      </div>
                      {mission.productName && (
                        <p className="mt-1 text-sm text-green-600">
                          Selected: {mission.productName}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
