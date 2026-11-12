import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ missionId?: string }>;
}) {
  const { missionId } = await searchParams;
  const returnPath = missionId && /^[a-zA-Z0-9-]+$/.test(missionId)
    ? `/missions/${missionId}`
    : '/missions';

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
          <h1 className="mt-4 text-2xl font-bold">Checkout canceled</h1>
          <p className="mt-2 text-gray-600">No payment was captured. You can return to the mission and try again.</p>
          <Link href={returnPath} className="mt-6 inline-block">
            <Button variant="outline">Return to mission</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
