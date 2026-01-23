import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password, displayName);

    if (error) {
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Access Granted',
        description: 'Your credentials have been established. Welcome to Aegis.',
      });
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
            Join the<br />
            <span className="aegis-gradient-text">Intelligence Network</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Aegis transforms complex security signals into clear, strategic narratives 
            for high-level decision-makers.
          </p>
        </div>

        <div className="relative z-10 text-sm text-muted-foreground">
          <p>A Silent Shield Intelligence System</p>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 aegis-glow">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <span className="font-serif text-2xl font-semibold aegis-gradient-text">AEGIS</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="font-serif text-2xl font-semibold">Request Access</h2>
            <p className="mt-2 text-muted-foreground">
              Establish your credentials for the intelligence platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your operational name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-card"
              />
            </div>

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
                  minLength={6}
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
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Establishing Access...' : 'Request Access'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have access?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
