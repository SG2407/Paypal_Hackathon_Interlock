'use client';

import { useState } from 'react';
import { Send, Lightbulb, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@/components/ui';

interface IntentInputProps {
  onSubmit: (intent: string) => Promise<void>;
  loading?: boolean;
  placeholder?: string;
}

const EXAMPLE_INTENTS = [
  "Buy a Sony or Bose headphones under $350, must be new condition",
  "Get me a laptop under $1000, no Chromebooks, I need it by next Friday",
  "Purchase a new iPhone, latest model, budget $1500, no refurbished",
  "Find running shoes from Nike or Adidas, max $150, size 10",
  "Buy a birthday gift under $100, something unique, no generic items",
];

export function IntentInput({ onSubmit, loading, placeholder }: IntentInputProps) {
  const [intent, setIntent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim() || loading) return;
    await onSubmit(intent.trim());
  };

  const handleExampleClick = (example: string) => {
    setIntent(example);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-600" />
          What would you like to buy?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-gray-600">
          Create one mission per product. The demonstration catalog currently contains headphones.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder={placeholder || "Describe what you want to purchase. Include your budget, preferred brands, conditions, and any requirements..."}
            className="min-h-[120px]"
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={!intent.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Intent...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Create Shopping Mission
              </>
            )}
          </Button>
        </form>

        {/* Example Intents */}
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Lightbulb className="h-4 w-4" />
            <span>Try an example:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_INTENTS.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                disabled={loading}
                className="text-left text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                &ldquo;{example.length > 50 ? example.slice(0, 50) + '...' : example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
