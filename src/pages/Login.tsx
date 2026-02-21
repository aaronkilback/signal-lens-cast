import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Authentication Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-card relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-primary blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 aegis-glow">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <span className="font-serif text-2xl font-semibold aegis-gradient-text">AEGIS</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="font-serif text-4xl font-semibold leading-tight">
            Strategic Intelligence.<br />
            <span className="aegis-gradient-text">Delivered with Clarity.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Aegis is your calm, strategic security intelligence advisor. 
            Transform complex signals into executive-ready insights.
          </p>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground">
          <p>A Silent Shield Intelligence System</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 aegis-glow">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <span className="font-serif text-2xl font-semibold aegis-gradient-text">AEGIS</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="font-serif text-2xl font-semibold">Access Portal</h2>
            <p className="mt-2 text-muted-foreground">
              Enter your credentials to access the intelligence platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="operative@silentshield.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-card pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!email) {
                    toast({ title: 'Enter your email first', variant: 'destructive' });
                    return;
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) {
                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Reset link sent', description: 'Check your email for the password reset link.' });
                  }
                }}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Authenticating...' : 'Access Platform'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Need access?{' '}
            <Link to="/signup" className="text-primary hover:underline">
              Request credentials
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
