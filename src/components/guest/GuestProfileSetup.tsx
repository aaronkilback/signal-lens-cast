import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X, Link as LinkIcon, Twitter, Linkedin, Instagram, Globe } from 'lucide-react';

interface GuestProfileSetupProps {
  invitationId: string;
  guestName: string;
  onComplete: () => void;
}

interface SocialLink {
  platform: string;
  url: string;
}

const SOCIAL_PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, placeholder: 'https://twitter.com/username' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/username' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username' },
  { id: 'website', label: 'Website', icon: Globe, placeholder: 'https://yourwebsite.com' },
];

export function GuestProfileSetup({ invitationId, guestName, onComplete }: GuestProfileSetupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const handleSocialLinkChange = (platform: string, value: string) => {
    setSocialLinks(prev => ({ ...prev, [platform]: value }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    if (!bio.trim()) {
      toast({
        title: 'Bio Required',
        description: 'Please provide a brief bio about yourself.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create or update guest profile
      const { error } = await supabase
        .from('guest_profiles')
        .upsert({
          user_id: user.id,
          name: guestName,
          display_name: guestName,
          bio: bio.trim(),
          expertise: expertise.split(',').map(e => e.trim()).filter(Boolean),
          social_links: socialLinks,
          cta_text: ctaText.trim() || null,
          cta_url: ctaUrl.trim() || null,
          invitation_id: invitationId,
          onboarding_completed: true,
        }, {
          onConflict: 'user_id,invitation_id',
        });

      if (error) throw error;
      
      toast({
        title: 'Profile Saved',
        description: 'Your profile has been set up successfully.',
      });
      
      onComplete();
    } catch (err) {
      console.error('Error saving profile:', err);
      toast({
        title: 'Error',
        description: 'Failed to save your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">📝</div>
          <CardTitle>Set Up Your Profile</CardTitle>
          <CardDescription>
            Tell us about yourself so Aegis can introduce you properly
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Your Bio *</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your professional background, achievements, and what you're known for..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This will be used by Aegis to introduce you at the start of the interview
            </p>
          </div>

          {/* Expertise */}
          <div className="space-y-2">
            <Label htmlFor="expertise">Areas of Expertise</Label>
            <Input
              id="expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="e.g., Cybersecurity, Risk Management, Executive Protection"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of your specialties
            </p>
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <Label>Social Links (Optional)</Label>
            <div className="space-y-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                return (
                  <div key={platform.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={socialLinks[platform.id] || ''}
                      onChange={(e) => handleSocialLinkChange(platform.id, e.target.value)}
                      placeholder={platform.placeholder}
                      className="flex-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              <Label className="text-primary">Your Call-to-Action</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Promote something to viewers! This will appear in the video.
            </p>
            <div className="space-y-2">
              <Input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="e.g., Download my free security checklist"
              />
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://yoursite.com/offer"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue to Recording'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
