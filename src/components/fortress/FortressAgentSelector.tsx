import { useFortressAgents, FortressAgent } from '@/hooks/useFortressAgents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FortressAgentSelectorProps {
  selectedAgent: FortressAgent | null;
  onAgentSelect: (agent: FortressAgent | null) => void;
}

export function FortressAgentSelector({ selectedAgent, onAgentSelect }: FortressAgentSelectorProps) {
  const { agents, loading, error, refetch } = useFortressAgents();

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 space-y-3">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-6">
        <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No Fortress agents available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {agents.map((agent) => (
        <Card
          key={agent.id}
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            selectedAgent?.id === agent.id && "border-primary bg-primary/5"
          )}
          onClick={() => onAgentSelect(selectedAgent?.id === agent.id ? null : agent)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{agent.codename}</h4>
                  <span className="text-xs text-muted-foreground">({agent.name})</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {agent.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.expertise.slice(0, 3).map((exp, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {exp}
                    </Badge>
                  ))}
                  {agent.expertise.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{agent.expertise.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
