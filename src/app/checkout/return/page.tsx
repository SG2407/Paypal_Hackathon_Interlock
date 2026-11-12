import CheckoutReturn from './return-client';

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <CheckoutReturn paypalOrderId={token ?? ''} />;
}
