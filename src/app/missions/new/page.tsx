'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { IntentInput, PolicyDisplay } from '@/components/intent';
import type { PermissionPolicy, IntentCompilationResponse } from '@/types/policy';

export default function NewMissionPage() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'clarify' | 'review'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [originalIntent, setOriginalIntent] = useState('');
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [compiledPolicy, setCompiledPolicy] = useState<PermissionPolicy | null>(null);
  const [compilationResult, setCompilationResult] = useState<IntentCompilationResponse | null>(null);

  const handleIntentSubmit = async (intent: string) => {
    setLoading(true);
    setError(null);
    setOriginalIntent(intent);
    setClarificationQuestions([]);
    setClarificationAnswers({});
    setCompiledPolicy(null);
    setCompilationResult(null);

    try {
      const response = await fetch('/api/intent/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to compile intent');
      }

      setCompilationResult(data);

      if (!data.success && data.clarificationQuestions?.length) {
        setClarificationQuestions(data.clarificationQuestions);
        setStep('clarify');
      } else if (data.success && data.policy) {
        setCompiledPolicy(data.policy);
        setStep('review');
      } else {
        throw new Error(data.rawInterpretation || 'The intent could not be converted into a policy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClarificationSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Re-compile with clarifications
      const clarifiedIntent = Object.entries(clarificationAnswers)
        .map(([q, a]) => `${q}: ${a}`)
        .join('. ');

      const response = await fetch('/api/intent/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: originalIntent,
          clarifications: clarifiedIntent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to compile intent');
      }

      if (data.success && data.policy) {
        setCompiledPolicy(data.policy);
        setCompilationResult(data);
        setStep('review');
      } else if (!data.success && data.clarificationQuestions?.length) {
        setClarificationQuestions(data.clarificationQuestions);
        setCompilationResult(data);
      } else {
        throw new Error(data.rawInterpretation || 'The intent could not be converted into a policy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async () => {
    if (!compiledPolicy) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: originalIntent,
          policy: compiledPolicy,
          compilationResult,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create mission');
      }

      router.push(`/missions/${data.mission.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/missions" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Missions
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Create Shopping Mission</h1>
        <p className="mt-1 text-gray-500">
          Describe what you want to buy and we&apos;ll create a secure policy for your purchase.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          {['input', 'clarify', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : ['review'].includes(step) && i < 2
                    ? 'bg-green-600 text-white'
                    : step === 'clarify' && i === 0
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {s === 'input' ? 'Enter Intent' : s === 'clarify' ? 'Clarify' : 'Review Policy'}
              </span>
              {i < 2 && <div className="mx-4 h-px w-12 bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Input */}
      {step === 'input' && (
        <div className="max-w-2xl">
          <IntentInput onSubmit={handleIntentSubmit} loading={loading} />
        </div>
      )}

      {/* Step: Clarify */}
      {step === 'clarify' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                We need a bit more information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-600">
                Your intent: &ldquo;{originalIntent}&rdquo;
              </p>

              {clarificationQuestions.map((question) => (
                <div key={question} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {question}
                  </label>
                  <input
                    type="text"
                    aria-label={question}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    value={clarificationAnswers[question] || ''}
                    onChange={(e) =>
                      setClarificationAnswers({ ...clarificationAnswers, [question]: e.target.value })
                    }
                    placeholder="Your answer..."
                  />
                </div>
              ))}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('input')} disabled={loading}>
                  Back
                </Button>
                <Button
                  onClick={handleClarificationSubmit}
                  disabled={loading || clarificationQuestions.some((question) => !clarificationAnswers[question]?.trim())}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && compiledPolicy && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Intent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">&ldquo;{originalIntent}&rdquo;</p>
                {compilationResult?.rawInterpretation && (
                  <p className="mt-4 text-sm text-gray-500">
                    {compilationResult.rawInterpretation}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('input')} disabled={loading}>
                Start Over
              </Button>
              <Button onClick={handleCreateMission} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Mission...
                  </>
                ) : (
                  'Confirm & Find Products'
                )}
              </Button>
            </div>
          </div>

          <PolicyDisplay policy={compiledPolicy} />
        </div>
      )}
    </div>
  );
}
