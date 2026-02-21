import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FortressSignal {
  id: string;
  normalized_text: string;
  severity: string;
  category: string;
  status: string;
  detected_at: string;
  source_type?: string;
  client_id?: string;
  client_name?: string;
  raw_text?: string;
  // Mapped fields for interview compatibility
  title: string;
  description: string;
  expertise: string[];
}

function mapApiSignal(raw: any): FortressSignal {
  return {
    id: raw.id,
    normalized_text: raw.normalized_text || raw.raw_text || '',
    severity: raw.severity || 'unknown',
    category: raw.category || 'general',
    status: raw.status || 'new',
    detected_at: raw.detected_at || raw.created_at || '',
    source_type: raw.source_type,
    client_id: raw.client_id,
    client_name: raw.client_name,
    raw_text: raw.raw_text,
    // Derived fields for interview use
    title: raw.normalized_text?.substring(0, 80) || raw.category || 'Signal',
    description: raw.normalized_text || raw.raw_text || '',
    expertise: [raw.category, raw.severity, raw.source_type].filter(Boolean),
  };
}

export function useFortressSignals() {
  const [signals, setSignals] = useState<FortressSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('fetch-fortress-signals', {
        body: { limit: '50' },
      });

      if (fnError) throw new Error(fnError.message);

      if (data?.signals && Array.isArray(data.signals)) {
        setSignals(data.signals.map(mapApiSignal));
      }
    } catch (err) {
      console.error('Failed to fetch Fortress signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  return { signals, loading, error, refetch: fetchSignals };
}
