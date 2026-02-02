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
  systemPrompt?: string;  // The agent's full persona/instructions
}

// Map Fortress API response to our expected interface
function mapApiAgent(apiAgent: any): FortressAgent {
  return {
    id: apiAgent.id,
    name: apiAgent.header_name || apiAgent.codename || 'Unknown',
    codename: apiAgent.codename || apiAgent.call_sign || 'Unknown',
    expertise: apiAgent.output_types || apiAgent.input_sources || [],
    description: apiAgent.mission_scope || '',
    voiceId: apiAgent.voice_id,
    personality: apiAgent.interaction_style,
    avatarImage: apiAgent.avatar_image,
    systemPrompt: apiAgent.persona,  // The full system prompt for the agent
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
