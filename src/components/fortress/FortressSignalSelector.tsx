import { useFortressSignals, FortressSignal } from '@/hooks/useFortressSignals';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw, AlertCircle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FortressSignalSelectorProps {
  selectedSignal: FortressSignal | null;
  onSignalSelect: (signal: FortressSignal | null) => void;
}

const severityColors: Record<string, string> = {
  p1: 'bg-destructive text-destructive-foreground',
  p2: 'bg-orange-500 text-white',
  p3: 'bg-yellow-500 text-black',
  p4: 'bg-muted text-muted-foreground',
};

export function FortressSignalSelector({ selectedSignal, onSignalSelect }: FortressSignalSelectorProps) {
  const { signals, loading, error, refetch } = useFortressSignals();

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
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

  if (signals.length === 0) {
    return (
      <div className="text-center py-6">
        <Radio className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No recent signals available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{signals.length} recent signals</span>
        <Button variant="ghost" size="sm" onClick={refetch} className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      {signals.map((signal) => (
        <Card
          key={signal.id}
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            selectedSignal?.id === signal.id && "border-primary bg-primary/5"
          )}
          onClick={() => onSignalSelect(selectedSignal?.id === signal.id ? null : signal)}
        >
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 leading-snug">
                  {signal.normalized_text || signal.category}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <Badge className={cn("text-[10px] px-1.5 py-0", severityColors[signal.severity] || severityColors.p4)}>
                    {signal.severity?.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {signal.category}
                  </Badge>
                  {signal.detected_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(signal.detected_at).toLocaleDateString()}
                    </span>
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
