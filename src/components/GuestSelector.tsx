import { useState, useEffect } from 'react';
import { Plus, User, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GuestProfile, VoiceOption, VOICE_OPTIONS } from '@/lib/aegis-types';

interface GuestSelectorProps {
  selectedGuestId: string | null;
  onGuestSelect: (guestId: string | null) => void;
}

export function GuestSelector({ selectedGuestId, onGuestSelect }: GuestSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestProfile | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [notableQuotes, setNotableQuotes] = useState('');
  const [voiceId, setVoiceId] = useState<VoiceOption>('echo');

  useEffect(() => {
    if (user) {
      fetchGuests();
    }
  }, [user]);

  const fetchGuests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('guest_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setGuests(data?.map(g => ({
        id: g.id,
        name: g.name,
        displayName: g.display_name,
        bio: g.bio,
        expertise: g.expertise || [],
        speakingStyle: g.speaking_style || undefined,
        notableQuotes: g.notable_quotes || undefined,
        voiceId: (g.voice_id || 'echo') as VoiceOption,
      })) || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDisplayName('');
    setBio('');
    setExpertise('');
    setSpeakingStyle('');
    setNotableQuotes('');
    setVoiceId('echo');
    setEditingGuest(null);
  };

  const openEditDialog = (guest: GuestProfile) => {
    setEditingGuest(guest);
    setName(guest.name);
    setDisplayName(guest.displayName);
    setBio(guest.bio);
    setExpertise(guest.expertise.join(', '));
    setSpeakingStyle(guest.speakingStyle || '');
    setNotableQuotes(guest.notableQuotes?.join('\n') || '');
    setVoiceId(guest.voiceId);
    setIsDialogOpen(true);
  };

  const handleSaveGuest = async () => {
    if (!user || !name.trim() || !displayName.trim() || !bio.trim()) {
      toast({
        title: 'Required Fields',
        description: 'Please fill in name, display name, and bio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const guestData = {
        user_id: user.id,
        name: name.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        expertise: expertise.split(',').map(e => e.trim()).filter(Boolean),
        speaking_style: speakingStyle.trim() || null,
        notable_quotes: notableQuotes.split('\n').map(q => q.trim()).filter(Boolean),
        voice_id: voiceId,
      };

      if (editingGuest) {
        const { error } = await supabase
          .from('guest_profiles')
          .update(guestData)
          .eq('id', editingGuest.id);

        if (error) throw error;
        toast({ title: 'Guest Updated', description: `${displayName} has been updated.` });
      } else {
        const { error } = await supabase
          .from('guest_profiles')
          .insert(guestData);

        if (error) throw error;
        toast({ title: 'Guest Added', description: `${displayName} has been added to your guest list.` });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchGuests();
    } catch (error) {
      console.error('Error saving guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to save guest profile.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    try {
      const { error } = await supabase
        .from('guest_profiles')
        .delete()
        .eq('id', guestId);

      if (error) throw error;
      
      if (selectedGuestId === guestId) {
        onGuestSelect(null);
      }
      
      toast({ title: 'Guest Removed' });
      fetchGuests();
    } catch (error) {
      console.error('Error deleting guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete guest.',
        variant: 'destructive',
      });
    }
  };

  const selectedGuest = guests.find(g => g.id === selectedGuestId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Guest (Optional)</Label>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1">
              <Plus className="h-3 w-3" />
              Add Guest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingGuest ? 'Edit Guest' : 'Add New Guest'}</DialogTitle>
              <DialogDescription>
                Create a guest profile for dialogue-style episodes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sean Ryan"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Sean"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Former Navy SEAL, host of Shawn Ryan Show, interviews operators and experts..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expertise">Areas of Expertise (comma-separated)</Label>
                <Input
                  id="expertise"
                  value={expertise}
                  onChange={(e) => setExpertise(e.target.value)}
                  placeholder="e.g., special operations, security, leadership"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="speakingStyle">Speaking Style</Label>
                <Textarea
                  id="speakingStyle"
                  value={speakingStyle}
                  onChange={(e) => setSpeakingStyle(e.target.value)}
                  placeholder="Describe how they speak: direct, uses military terminology, asks probing questions..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notableQuotes">Notable Phrases (one per line)</Label>
                <Textarea
                  id="notableQuotes"
                  value={notableQuotes}
                  onChange={(e) => setNotableQuotes(e.target.value)}
                  placeholder="Catchphrases or typical things they say..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voiceId">Voice for Audio</Label>
                <Select value={voiceId} onValueChange={(v) => setVoiceId(v as VoiceOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map(voice => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label} - {voice.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveGuest} className="w-full">
                {editingGuest ? 'Update Guest' : 'Add Guest'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Guest Selection */}
      <Select
        value={selectedGuestId || 'none'}
        onValueChange={(v) => onGuestSelect(v === 'none' ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Solo episode (no guest)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Solo episode (no guest)</SelectItem>
          {guests.map(guest => (
            <SelectItem key={guest.id} value={guest.id}>
              {guest.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Selected Guest Preview */}
      {selectedGuest && (
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{selectedGuest.name}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => openEditDialog(selectedGuest)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleDeleteGuest(selectedGuest.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{selectedGuest.bio}</p>
            {selectedGuest.expertise.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedGuest.expertise.slice(0, 3).map((exp, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {exp}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Voice: {VOICE_OPTIONS.find(v => v.value === selectedGuest.voiceId)?.label || 'Echo'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}