import { useState, useEffect } from 'react';
import { Zap, ChevronDown, ChevronUp, Loader2, AlertTriangle, TrendingUp, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EpisodeSuggestion {
  topic: string;
  rationale: string;
  urgency: 'high' | 'medium' | 'low';
  domains: string[];
  intelligence_source: string;
}

interface IntelligenceSuggestionsProps {
  onSelectTopic: (topic: string, domains?: string[]) => void;
}

const URGENCY_CONFIG = {
  high: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertTriangle },
  medium: { label: 'Active', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: TrendingUp },
  low: { label: 'Emerging', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Radio },
};

export function IntelligenceSuggestions({ onSelectTopic }: IntelligenceSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<EpisodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(false);

  const loadSuggestions = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-episode-topics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        setIsExpanded(true);
      }
      setHasLoaded(true);
    } catch {
      setError(true);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (!hasLoaded && !isLoading) {
      loadSuggestions();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = (suggestion: EpisodeSuggestion) => {
    onSelectTopic(suggestion.topic, suggestion.domains);
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/10 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Intelligence-Driven Topic Suggestions</span>
          {suggestions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {suggestions.length} signals
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {!isLoading && (isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {error && (
            <p className="text-xs text-muted-foreground py-2">
              Could not load intelligence — Fortress connection may be unavailable.
            </p>
          )}

          {suggestions.length === 0 && !error && !isLoading && hasLoaded && (
            <p className="text-xs text-muted-foreground py-2">
              No significant patterns detected yet. Check back as more intelligence accumulates.
            </p>
          )}

          {suggestions.map((suggestion, i) => {
            const urgencyConfig = URGENCY_CONFIG[suggestion.urgency] || URGENCY_CONFIG.medium;
            const UrgencyIcon = urgencyConfig.icon;

            return (
              <div
                key={i}
                className={`rounded-md border p-3 space-y-2 cursor-pointer hover:opacity-80 transition-opacity ${urgencyConfig.bg}`}
                onClick={() => handleSelect(suggestion)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">{suggestion.topic}</p>
                  <div className={`flex items-center gap-1 text-xs shrink-0 ${urgencyConfig.color}`}>
                    <UrgencyIcon className="h-3 w-3" />
                    <span>{urgencyConfig.label}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{suggestion.rationale}</p>
                {suggestion.intelligence_source && (
                  <p className="text-xs text-muted-foreground/60 italic">
                    Source: {suggestion.intelligence_source}
                  </p>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 w-full justify-start">
                  Use this topic →
                </Button>
              </div>
            );
          })}

          {hasLoaded && suggestions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground w-full"
              onClick={(e) => { e.stopPropagation(); loadSuggestions(); }}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Refresh intelligence
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
