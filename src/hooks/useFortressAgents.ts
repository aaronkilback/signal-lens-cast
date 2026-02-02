import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FortressAgent {
  id: string;
  name: string;
  codename: string;
  expertise: string[];
  description: string;
  voiceId?: string;
  personality?: string;
}

export function useFortressAgents() {
  const [agents, setAgents] = useState<FortressAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fnError } = await supabase.functions.invoke('fetch-fortress-agents');

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data?.agents) {
          setAgents(data.agents);
        }
      } catch (err) {
        console.error('Failed to fetch Fortress agents:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  const refetch = async () => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-fortress-agents');
      if (fnError) throw new Error(fnError.message);
      if (data?.agents) setAgents(data.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  return { agents, loading, error, refetch };
}
