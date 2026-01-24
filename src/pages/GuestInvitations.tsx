import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Mail, Clock, CheckCircle, XCircle, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Invitation {
  id: string;
  invite_token: string;
  guest_name: string;
  guest_email: string | null;
  topic: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export default function GuestInvitations() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [topic, setTopic] = useState('');

  const fetchInvitations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('guest_invitations')
      .select('*')
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching invitations:', error);
    } else {
      setInvitations(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvitations();
  }, [user]);

  const handleCreateInvitation = async () => {
    if (!user || !guestName.trim()) {
      toast({
        title: 'Guest Name Required',
        description: 'Please enter the guest\'s name.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('guest_invitations')
        .insert({
          host_user_id: user.id,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          topic: topic.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setInvitations(prev => [data, ...prev]);
      setDialogOpen(false);
      setGuestName('');
      setGuestEmail('');
      setTopic('');
      
      toast({
        title: 'Invitation Created',
        description: 'You can now share the invite link with your guest.',
      });
    } catch (err) {
      console.error('Error creating invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to create invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/guest/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The invite link has been copied to your clipboard.',
    });
  };

  const deleteInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('guest_invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvitations(prev => prev.filter(inv => inv.id !== id));
      toast({
        title: 'Invitation Deleted',
        description: 'The invitation has been removed.',
      });
    } catch (err) {
      console.error('Error deleting invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete invitation.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (isExpired || status === 'expired') {
      return <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'accepted':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Mail className="h-8 w-8 text-primary" />
              Guest Invitations
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage interview invitations for external guests
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Invitation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a Guest</DialogTitle>
                <DialogDescription>
                  Create an invitation link to send to your interview guest
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Guest Name *</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">Guest Email (optional)</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    For your reference only - we won't send automated emails
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="topic">Interview Topic (optional)</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Executive Travel Security"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateInvitation} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Invitation'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : invitations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Invitations Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first invitation to start interviewing guests
              </p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Invitation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{invitation.guest_name}</h3>
                        {getStatusBadge(invitation.status, invitation.expires_at)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {invitation.topic && (
                          <p>Topic: {invitation.topic}</p>
                        )}
                        {invitation.guest_email && (
                          <p>Email: {invitation.guest_email}</p>
                        )}
                        <p>
                          Created {format(new Date(invitation.created_at), 'MMM d, yyyy')}
                          {' • '}
                          Expires {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInviteLink(invitation.invite_token)}
                        className="gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/guest/${invitation.invite_token}`, '_blank')}
                        className="gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvitation(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
