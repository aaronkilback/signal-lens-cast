import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { GuestOnboarding } from '@/components/guest/GuestOnboarding';
import { GuestProfileSetup } from '@/components/guest/GuestProfileSetup';
import { GuestRecordingStudio } from '@/components/guest/GuestRecordingStudio';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type PortalStep = 'loading' | 'auth' | 'onboarding' | 'profile' | 'recording' | 'complete' | 'error';

interface Invitation {
  id: string;
  guest_name: string;
  topic: string | null;
  status: string;
  host_user_id: string;
}

export default function GuestPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<PortalStep>('loading');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate invitation token
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setStep('error');
        return;
      }

      try {
        // Fetch invitation by token (this needs to work for unauthenticated users)
        const { data, error: fetchError } = await supabase
          .from('guest_invitations')
          .select('*')
          .eq('invite_token', token)
          .single();

        if (fetchError || !data) {
          setError('Invitation not found or has expired');
          setStep('error');
          return;
        }

        if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired');
          setStep('error');
          return;
        }

        if (data.status === 'completed') {
          setError('This interview has already been completed');
          setStep('error');
          return;
        }

        setInvitation(data);
        
        // Determine next step based on auth state
        if (!user) {
          setStep('auth');
        } else if (data.status === 'pending') {
          // First time - show onboarding
          setStep('onboarding');
        } else {
          // Returning user - check profile completion
          setStep('profile');
        }
      } catch (err) {
        console.error('Error validating invitation:', err);
        setError('Failed to validate invitation');
        setStep('error');
      }
    };

    if (!authLoading) {
      validateToken();
    }
  }, [token, user, authLoading]);

  // Handle signup/login redirect
  const handleAuthRedirect = () => {
    // Store token in session storage for post-auth redirect
    sessionStorage.setItem('guest_invite_token', token || '');
    navigate(`/signup?redirect=/guest/${token}`);
  };

  const handleOnboardingComplete = async () => {
    if (!invitation || !user) return;
    
    // Update invitation status
    await supabase
      .from('guest_invitations')
      .update({ 
        status: 'accepted', 
        accepted_at: new Date().toISOString(),
        guest_user_id: user.id 
      })
      .eq('id', invitation.id);
    
    setStep('profile');
  };

  const handleProfileComplete = async () => {
    if (!invitation || !user) return;
    
    try {
      // Create interview session
      const { data: session, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          invitation_id: invitation.id,
          guest_user_id: user.id,
          host_user_id: invitation.host_user_id,
          status: 'setup'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      
      setSessionId(session.id);
      setStep('recording');
    } catch (err) {
      console.error('Error creating session:', err);
      toast({
        title: 'Error',
        description: 'Failed to start recording session',
        variant: 'destructive',
      });
    }
  };

  const handleRecordingComplete = () => {
    setStep('complete');
  };

  if (step === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Unable to Access</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')}>Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🎙️</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Welcome, {invitation?.guest_name}!
            </h2>
            <p className="text-muted-foreground mb-6">
              You've been invited to record an interview with Aegis.
              {invitation?.topic && (
                <span className="block mt-2 font-medium text-foreground">
                  Topic: {invitation.topic}
                </span>
              )}
            </p>
            <Button onClick={handleAuthRedirect} size="lg" className="w-full">
              Create Account to Continue
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Already have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => {
                sessionStorage.setItem('guest_invite_token', token || '');
                navigate(`/login?redirect=/guest/${token}`);
              }}>
                Log in
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'onboarding' && invitation) {
    return (
      <GuestOnboarding 
        guestName={invitation.guest_name}
        topic={invitation.topic || undefined}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  if (step === 'profile' && invitation) {
    return (
      <GuestProfileSetup
        invitationId={invitation.id}
        guestName={invitation.guest_name}
        onComplete={handleProfileComplete}
      />
    );
  }

  if (step === 'recording' && invitation && sessionId) {
    return (
      <GuestRecordingStudio
        sessionId={sessionId}
        guestName={invitation.guest_name}
        topic={invitation.topic || undefined}
        onComplete={handleRecordingComplete}
      />
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Interview Complete!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for recording your interview. The host will be notified and will 
              process the final video.
            </p>
            <p className="text-sm text-primary font-medium">
              Fortune favors the fortified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
