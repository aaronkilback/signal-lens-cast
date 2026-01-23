import { useEffect, useState } from 'react';
import { Library as LibraryIcon, Trash2, Eye, Clock, Target } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { OUTPUT_MODE_OPTIONS } from '@/lib/aegis-types';

interface Episode {
  id: string;
  title: string;
  topic: string;
  target_audience: string;
  risk_domains: string[];
  content_length: number;
  tone_intensity: string;
  output_mode: string;
  script_content: string | null;
  status: string;
  created_at: string;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    fetchEpisodes();
  }, [user]);

  const fetchEpisodes = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching episodes:', error);
    } else {
      setEpisodes(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('episodes').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the episode.',
        variant: 'destructive',
      });
    } else {
      setEpisodes(episodes.filter(e => e.id !== id));
      toast({
        title: 'Episode Deleted',
        description: 'Removed from your library.',
      });
    }
  };

  const getOutputModeLabel = (mode: string) => {
    return OUTPUT_MODE_OPTIONS.find(o => o.value === mode)?.label || mode;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AppLayout>
      <div className="container py-8 animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <LibraryIcon className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-semibold">Episode Library</h1>
          </div>
          <p className="text-muted-foreground">
            Access and manage your generated intelligence content.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="aegis-card animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <Card className="aegis-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <LibraryIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">No Episodes Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Generate your first piece of strategic intelligence content to populate your library.
              </p>
              <Button className="mt-6" asChild>
                <a href="/generate">Generate Content</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {episodes.map((episode) => (
              <Card key={episode.id} className="aegis-card hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg line-clamp-2">{episode.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatDate(episode.created_at)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {getOutputModeLabel(episode.output_mode)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {episode.risk_domains.map((domain) => (
                      <Badge key={domain} variant="outline" className="text-xs">
                        {domain}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>{episode.content_length} min • {episode.tone_intensity}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedEpisode(episode)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(episode.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Episode Detail Dialog */}
        <Dialog open={!!selectedEpisode} onOpenChange={() => setSelectedEpisode(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {selectedEpisode && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">{selectedEpisode.title}</DialogTitle>
                  <DialogDescription>
                    {getOutputModeLabel(selectedEpisode.output_mode)} • {selectedEpisode.content_length} minutes • {selectedEpisode.tone_intensity}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selectedEpisode.script_content}
                  </pre>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
