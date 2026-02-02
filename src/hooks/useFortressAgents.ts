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
  avatarImage?: string;
}

// Map Fortress API response to our expected interface
function mapApiAgent(apiAgent: any): FortressAgent {
  return {
    id: apiAgent.id,
    name: apiAgent.header_name || apiAgent.codename || 'Unknown',
    codename: apiAgent.codename || apiAgent.call_sign || 'Unknown',
    expertise: apiAgent.input_sources || apiAgent.output_types || [],
    description: apiAgent.mission_scope || apiAgent.persona || '',
    voiceId: apiAgent.voice_id,
    personality: apiAgent.persona,
    avatarImage: apiAgent.avatar_image,
  };
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

        if (data?.agents && Array.isArray(data.agents)) {
          setAgents(data.agents.map(mapApiAgent));
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
      if (data?.agents && Array.isArray(data.agents)) {
        setAgents(data.agents.map(mapApiAgent));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  return { agents, loading, error, refetch };
}
