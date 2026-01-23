import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mic, Library, FileText, TrendingUp, Clock, Target } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Stats {
  totalEpisodes: number;
  completedEpisodes: number;
  doctrineDocuments: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalEpisodes: 0, completedEpisodes: 0, doctrineDocuments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      const [episodesRes, doctrineRes] = await Promise.all([
        supabase.from('episodes').select('status', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('doctrine_documents').select('id', { count: 'exact' }).eq('user_id', user.id),
      ]);

      const episodes = episodesRes.data || [];
      const completedCount = episodes.filter(e => e.status === 'completed').length;

      setStats({
        totalEpisodes: episodesRes.count || 0,
        completedEpisodes: completedCount,
        doctrineDocuments: doctrineRes.count || 0,
      });
      setLoading(false);
    }

    fetchStats();
  }, [user]);

  const quickActions = [
    {
      title: 'Generate Content',
      description: 'Create a new podcast episode or briefing',
      icon: Mic,
      href: '/generate',
      primary: true,
    },
    {
      title: 'View Library',
      description: 'Access your generated episodes',
      icon: Library,
      href: '/library',
    },
    {
      title: 'Manage Doctrine',
      description: 'Upload Silent Shield documentation',
      icon: FileText,
      href: '/doctrine',
    },
  ];

  return (
    <AppLayout>
      <div className="container py-8 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-semibold">Command Center</h1>
            </div>
          </div>
          <p className="text-muted-foreground mt-2">
            Welcome back. Your intelligence platform is operational.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="aegis-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Episodes
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-semibold">
                {loading ? '—' : stats.totalEpisodes}
              </div>
            </CardContent>
          </Card>

          <Card className="aegis-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
              <Clock className="h-4 w-4 text-aegis-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-semibold">
                {loading ? '—' : stats.completedEpisodes}
              </div>
            </CardContent>
          </Card>

          <Card className="aegis-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Doctrine Files
              </CardTitle>
              <Target className="h-4 w-4 text-aegis-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-semibold">
                {loading ? '—' : stats.doctrineDocuments}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link key={action.href} to={action.href}>
                <Card className={`aegis-card h-full transition-all hover:border-primary/50 hover:aegis-glow cursor-pointer ${action.primary ? 'border-primary/30' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.primary ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{action.title}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Aegis Introduction */}
        <Card className="aegis-card aegis-section-border pl-6">
          <CardHeader>
            <CardTitle className="font-serif text-xl">About Aegis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Aegis is a calm, strategic security intelligence advisor. Unlike conventional content systems, 
              Aegis delivers insights with the precision of an intelligence briefing and the authority of a 
              trusted advisor.
            </p>
            <p>
              Every piece of content follows the Silent Shield doctrine—emphasizing fortification, 
              layered defense, signal detection, and decision velocity.
            </p>
            <Button asChild className="mt-4">
              <Link to="/generate">Begin Intelligence Generation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
