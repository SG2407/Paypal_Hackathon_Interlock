import Link from 'next/link';
import { Shield, Zap, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';

const features = [
  {
    icon: Shield,
    title: 'Intent Protection',
    description: 'Your natural language shopping instructions are compiled into strict, deterministic purchasing policies.',
  },
  {
    icon: Lock,
    title: 'Pre-Capture Validation',
    description: 'Every transaction is validated against your policy BEFORE payment capture - preventing unauthorized purchases.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Matching',
    description: 'Smart product recommendations scored against your requirements with transparent reasoning.',
  },
  {
    icon: CheckCircle,
    title: 'Cryptographic Receipts',
    description: 'Hash-chained audit trails prove exactly what was authorized and purchased.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Shop with{' '}
              <span className="text-blue-600">Intent</span>,{' '}
              <br />
              Pay with{' '}
              <span className="text-blue-600">Confidence</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              IntentLock transforms your natural language shopping instructions into
              bulletproof purchasing policies. AI compiles your intent, deterministic
              validation enforces it, and cryptographic receipts prove it.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/missions/new">
                <Button size="lg" className="gap-2">
                  Start Shopping Mission
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/missions">
                <Button size="lg" variant="outline">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-x-0 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-200 to-blue-400 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How IntentLock Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From natural language to secure checkout in four simple steps.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                    <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to shop smarter?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Create your first shopping mission and experience intent-based authorization.
          </p>
          <Link href="/missions/new" className="mt-8 inline-block">
            <Button size="lg" variant="secondary" className="gap-2">
              Create Mission
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>Built for PayPal AI Hackathon 2025</p>
          <p className="mt-1">IntentLock - AI-Powered Transaction Authorization</p>
        </div>
      </footer>
    </div>
  );
}
