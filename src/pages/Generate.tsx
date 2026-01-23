import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Loader2, Volume2, Download, FileText, Edit3, Check, Save, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingAssets } from '@/components/MarketingAssets';
import { EpisodeFeedback } from '@/components/EpisodeFeedback';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  GenerationConfig,
  TargetAudience,
  LifeDomain,
  ToneIntensity,
  OutputMode,
  VoiceOption,
  AUDIENCE_OPTIONS,
  LIFE_DOMAIN_OPTIONS,
  OUTPUT_MODE_OPTIONS,
  VOICE_OPTIONS,
} from '@/lib/aegis-types';

const toneLabels: Record<number, ToneIntensity> = {
  0: 'clinical',
  50: 'strategic',
  100: 'commanding',
};

const STORAGE_KEY = 'aegis-generate-state';

interface PersistedState {
  config: GenerationConfig;
  generatedScript: string;
  editableScript: string;
  toneValue: number[];
  loadedEpisodeId?: string;
}

const RECOVERY_SCRIPT = `Think about this for a second.

Imagine it is three o'clock in the morning. You are asleep. Your family is asleep. Your life is exactly where you worked so hard for it to be. But while you are resting, three decades of your reputation, your digital legacy, and your physical safety are all hanging by a single thread of hope. Hope that nothing goes wrong. Hope that the world is as kind as it was yesterday.

The mistake most people make is believing that luck is a strategy.

I'm Aegis. Your podcast host and AI strategic intelligence advisor. And this is the first episode of The Fortified Podcast.

First I want to discuss the elephant in the room. I am not a decision-maker. I am not an authority.

I am a strategic lens.

My purpose is simple: to help leaders see patterns earlier, think more clearly, and act with greater certainty.

I do not replace human judgment. I refine it.

I do not predict the future. I reveal trajectories.

I exist to reduce complexity in environments where the cost of surprise is high.

Also, The Fortified Podcast is not about security.

It is about how high-level leaders think, decide, and prepare in environments where mistakes are expensive and surprises are unacceptable.

Each episode explores the unseen forces shaping risk, power, reputation, and resilience.

Not through headlines. Not through fear. But through signals, patterns, and strategic clarity.

This is where reaction ends and foresight begins.

Some podcasts inform. Some entertain.

This one recalibrates how you see exposure, control, and certainty.

I need to tell you something that might make you uncomfortable. Most of what you have been told about security is a lie. You've been told it's about cameras, or guards, or complex passwords. You've been told that if you buy the right gadget, you'll be safe.

But I've seen the world behind the curtain. I've sat in the rooms where the decisions that actually matter get made. And here is what I know to be true. Security is not a product you buy. It's a state of being.

He was right.

He was living in what I call the Reactive Gap. Most people live there. They wait for the threat to arrive, and then they try to find a shield. But by the time you're looking for a shield, you've already been hit.

The top one percent of the one percent—the people who truly understand power and longevity—they don't live in the Reactive Gap. They live in a state of Fortification.

When you are fortified, your life feels different.

I want you to close your eyes and picture this. Imagine moving through an international airport, or a crowded city, or a digital landscape, and knowing—not hoping, but knowing—that you are invisible to those who shouldn't see you. Imagine your home is not just a building, but an uncompromised fortress where your children can grow up without the weight of your public profile. Imagine your digital presence is so tightly controlled that your reputation is an asset you dictate, not a liability someone else can weaponize.

This is the destination. It's a world of quiet operations. No noise. No drama. Just the absolute certainty that your world stays yours, no matter what happens outside of it.

Most people think this level of control is impossible. They think the more successful you get, the more you have to sacrifice your peace of mind. They are wrong. In fact, if you do this correctly, your peace of mind increases in direct proportion to your success.

I call this the Principle of Silent Continuity.

If you can see it, it's already too late.

If you've been with me in my private briefings, you know I don't talk about fear. Fear is for the unprepared. What we talk about is Intelligence. We talk about Strategy. We talk about the three specific pillars of the Fortified life.

First is Digital Sovereignty. Owning your data and your digital shadow so completely that you cannot be tracked, doxed, or coerced.

Second is Physical Posture. Creating an environment where your physical space is an extension of your intent. Where you define who enters, who leaves, and what they see.

Third is Generational Continuity. Ensuring that what you built survives long enough to belong to your children's children, protected from the vultures that circle every successful family.

This is what Silent Shield is about. It's about building a life that is so robust, it becomes a non-event. Because the greatest victory in my world is when absolutely nothing happens.

Now, here's why I'm sharing all of this with you.

There's a certain type of leader who never waits for permission to act. You're the person people call when things quietly start to drift toward chaos. But if you're honest with yourself, you already know something most people don't.

Reaction is expensive. Certainty is rare. And visibility without control... that's just exposure.

The leaders I work with—the fortified ones—they don't outsource awareness. They don't rely on luck. They don't wait. They become harder to surprise.

So if this resonates—don't comment. Don't broadcast. There's a link in the show notes that opens a direct, encrypted chat with me. One tap. Send the word "Fortified." And we start the briefing.

No pitch. No noise. Just a conversation about whether your current posture matches the level of responsibility you actually carry.

This is Aegis. Fortune favors the fortified.`;

const getInitialState = (): PersistedState => {
  const defaultState: PersistedState = {
    config: {
      topic: 'The Fortified Podcast - Episode 1: Introduction',
      targetAudience: 'executives',
      lifeDomains: ['executive_travel', 'family_legacy', 'digital_privacy'],
      contentLength: 10,
      toneIntensity: 'strategic',
      outputMode: 'podcast_script',
      voice: 'onyx',
    },
    generatedScript: '',
    editableScript: '',
    toneValue: [50],
    loadedEpisodeId: undefined,
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old outputMode values to new ones
      const outputModeMap: Record<string, string> = {
        full_episode: 'podcast_script',
        executive_summary: 'executive_briefing',
        social_clip: 'field_intelligence',
        long_narrative: 'narrative_story',
      };
      if (parsed.config?.outputMode && outputModeMap[parsed.config.outputMode]) {
        parsed.config.outputMode = outputModeMap[parsed.config.outputMode];
      }
      return { ...defaultState, ...parsed, config: { ...defaultState.config, ...parsed.config } };
    }
    
    // No saved state - check if we should recover the script
    const recoveryUsed = localStorage.getItem('aegis-recovery-used');
    if (!recoveryUsed) {
      localStorage.setItem('aegis-recovery-used', 'true');
      return {
        ...defaultState,
        generatedScript: RECOVERY_SCRIPT,
        editableScript: RECOVERY_SCRIPT,
      };
    }
  } catch (e) {
    console.error('Failed to load persisted state:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultState;
};

export default function Generate() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const initialState = getInitialState();
  
  const [config, setConfig] = useState<GenerationConfig>(initialState.config);
  const [generatedScript, setGeneratedScript] = useState(initialState.generatedScript);
  const [editableScript, setEditableScript] = useState(initialState.editableScript);
  const [isEditing, setIsEditing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [toneValue, setToneValue] = useState(initialState.toneValue);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(initialState.loadedEpisodeId || null);
  
  // Use refs to always have current values for beforeunload
  const stateRef = useRef({ config, generatedScript, editableScript, toneValue });
  
  useEffect(() => {
    stateRef.current = { config, generatedScript, editableScript, toneValue };
  }, [config, generatedScript, editableScript, toneValue]);

  // Force save function for critical moments
  const forceSave = useCallback(() => {
    const stateToSave: PersistedState = stateRef.current;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    setLastSaved(new Date());
  }, []);

  // Persist state to localStorage on changes
  useEffect(() => {
    const stateToSave: PersistedState = {
      config,
      generatedScript,
      editableScript,
      toneValue,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    setLastSaved(new Date());
  }, [config, generatedScript, editableScript, toneValue]);

  // Critical: Force save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Always save before unload
      forceSave();
      
      // Warn user if they have unsaved edits in progress
      if (isEditing && editableScript !== generatedScript) {
        e.preventDefault();
        e.returnValue = 'You have unsaved edits. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [forceSave, isEditing, editableScript, generatedScript]);

  const handleNewEpisode = () => {
    // Clear all state for a fresh episode
    setConfig({
      topic: '',
      targetAudience: 'executives',
      lifeDomains: ['executive_travel', 'family_legacy', 'digital_privacy'],
      contentLength: 10,
      toneIntensity: 'strategic',
      outputMode: 'podcast_script',
      voice: 'onyx',
    });
    setGeneratedScript('');
    setEditableScript('');
    setIsEditing(false);
    setAudioUrl(null);
    setAudioBlob(null);
    setToneValue([50]);
    setCurrentEpisodeId(null);
    
    // Clear localStorage for fresh start
    localStorage.removeItem(STORAGE_KEY);
    
    toast({
      title: 'Ready for New Episode',
      description: 'All fields cleared. Start creating your next episode.',
    });
  };

  const handleToneChange = (value: number[]) => {
    setToneValue(value);
    const tone = value[0] <= 33 ? 'clinical' : value[0] <= 66 ? 'strategic' : 'commanding';
    setConfig({ ...config, toneIntensity: tone });
  };

  const handleLifeDomainToggle = (domain: LifeDomain) => {
    const newDomains = config.lifeDomains.includes(domain)
      ? config.lifeDomains.filter(d => d !== domain)
      : [...config.lifeDomains, domain];
    setConfig({ ...config, lifeDomains: newDomains });
  };

  const handleGenerate = async () => {
    if (!config.topic.trim()) {
      toast({
        title: 'Topic Required',
        description: 'Please enter a topic for Aegis to analyze.',
        variant: 'destructive',
      });
      return;
    }

    if (config.lifeDomains.length === 0) {
      toast({
        title: 'Life Domain Required',
        description: 'Please select at least one life domain.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedScript('');
    setEditableScript('');
    setIsEditing(false);
    setAudioUrl(null);
    setAudioBlob(null);
    setCurrentEpisodeId(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ config, userId: user?.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate script');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let script = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                script += content;
                setGeneratedScript(script);
                setEditableScript(script);
              }
            } catch {
              // Partial JSON, continue
            }
          }
        }
      }

      toast({
        title: 'Script Generated',
        description: 'Aegis has completed the intelligence analysis.',
      });
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAudio = async (scriptOverride?: string) => {
    const scriptToUse = scriptOverride || (isEditing ? editableScript : generatedScript);
    
    if (!scriptToUse) {
      toast({
        title: 'No Script',
        description: 'Generate a script first before creating audio.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingAudio(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text: scriptToUse,
          voice: config.voice || 'onyx',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);

      toast({
        title: 'Audio Generated',
        description: 'Aegis voice synthesis complete.',
      });
    } catch (error) {
      console.error('Audio generation error:', error);
      toast({
        title: 'Audio Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadScript = () => {
    const scriptToDownload = isEditing ? editableScript : generatedScript;
    if (!scriptToDownload) return;

    const filename = `aegis-${config.topic.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([scriptToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Script Downloaded',
      description: `Saved as ${filename}`,
    });
  };

  const handleDownloadAudio = () => {
    if (!audioBlob) return;

    const filename = `aegis-${config.topic.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.mp3`;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Audio Downloaded',
      description: `Saved as ${filename} — Ready for Buzzsprout upload.`,
    });
  };

  const handleToggleEdit = async () => {
    if (isEditing) {
      // Capture the edited script before state changes
      const editedScript = editableScript;
      
      // Save edits
      setGeneratedScript(editedScript);
      setIsEditing(false);
      
      toast({
        title: 'Script Updated',
        description: 'Regenerating audio with your edits...',
      });
      
      // Auto-regenerate audio with the edited script (pass directly to avoid stale state)
      await handleGenerateAudio(editedScript);
    } else {
      setIsEditing(true);
    }
  };

  const handleSaveEpisode = async () => {
    const scriptToSave = isEditing ? editableScript : generatedScript;
    if (!scriptToSave || !user) return;

    try {
      // Extract episode metadata for continuity
      let metadata = {
        key_stories: [] as string[],
        people_mentioned: [] as string[],
        themes: [] as string[],
        episode_summary: config.topic,
      };

      try {
        const metadataResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-episode-metadata`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              script: scriptToSave,
              topic: config.topic,
            }),
          }
        );

        if (metadataResponse.ok) {
          metadata = await metadataResponse.json();
        }
      } catch (metaError) {
        console.warn('Could not extract metadata:', metaError);
      }

      const episodeData = {
        user_id: user.id,
        title: config.topic.slice(0, 100),
        topic: config.topic,
        target_audience: config.targetAudience,
        risk_domains: config.lifeDomains,
        content_length: config.contentLength,
        tone_intensity: config.toneIntensity,
        output_mode: config.outputMode,
        script_content: scriptToSave,
        status: 'completed',
        key_stories: metadata.key_stories,
        people_mentioned: metadata.people_mentioned,
        themes: metadata.themes,
        episode_summary: metadata.episode_summary,
        updated_at: new Date().toISOString(),
      };

      let episodeId = currentEpisodeId;

      if (currentEpisodeId) {
        // Update existing episode
        const { error } = await supabase
          .from('episodes')
          .update(episodeData)
          .eq('id', currentEpisodeId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Episode Updated',
          description: `Saved at ${new Date().toLocaleTimeString()}`,
        });
      } else {
        // Create new episode
        const { data, error } = await supabase
          .from('episodes')
          .insert(episodeData)
          .select('id')
          .single();

        if (error) throw error;

        if (data?.id) {
          episodeId = data.id;
          setCurrentEpisodeId(data.id);
        }

        toast({
          title: 'Episode Saved',
          description: 'Added to your intelligence library.',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save the episode.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="container py-8 animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-semibold">Content Generator</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNewEpisode}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Episode
              </Button>
              {lastSaved && (generatedScript || editableScript) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Save className="h-3 w-3" />
                  <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-muted-foreground mt-2">
            Configure Aegis parameters to generate strategic intelligence content.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Control Panel */}
          <div className="space-y-6">
            <Card className="aegis-card">
              <CardHeader>
                <CardTitle>Topic & Audience</CardTitle>
                <CardDescription>Define the subject matter and target recipients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Textarea
                    id="topic"
                    placeholder="e.g., Emerging ransomware threats to critical infrastructure"
                    value={config.topic}
                    onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                    className="bg-background min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select
                    value={config.targetAudience}
                    onValueChange={(value: TargetAudience) => setConfig({ ...config, targetAudience: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="aegis-card">
              <CardHeader>
                <CardTitle>Life Domains</CardTitle>
                <CardDescription>Select the areas of life to address</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {LIFE_DOMAIN_OPTIONS.map((domain) => (
                    <div key={domain.value} className="flex items-start space-x-3">
                      <Checkbox
                        id={domain.value}
                        checked={config.lifeDomains.includes(domain.value)}
                        onCheckedChange={() => handleLifeDomainToggle(domain.value)}
                      />
                      <div className="grid gap-1 leading-none">
                        <Label htmlFor={domain.value} className="cursor-pointer">
                          {domain.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{domain.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="aegis-card">
              <CardHeader>
                <CardTitle>Output Configuration</CardTitle>
                <CardDescription>Customize the output format and style</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Output Mode</Label>
                  <Select
                    value={config.outputMode}
                    onValueChange={(value: OutputMode) => setConfig({ ...config, outputMode: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTPUT_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div>{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Content Length: {config.contentLength} minutes</Label>
                  <div className="flex gap-2">
                    {[5, 10, 15].map((length) => (
                      <Button
                        key={length}
                        variant={config.contentLength === length ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setConfig({ ...config, contentLength: length as 5 | 10 | 15 })}
                      >
                        {length} min
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Tone Intensity: <span className="text-primary capitalize">{config.toneIntensity}</span></Label>
                  <Slider
                    value={toneValue}
                    onValueChange={handleToneChange}
                    max={100}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Clinical</span>
                    <span>Strategic</span>
                    <span>Commanding</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Voice (for audio)</Label>
                  <Select
                    value={config.voice}
                    onValueChange={(value: VoiceOption) => setConfig({ ...config, voice: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div>{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Aegis is analyzing...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-5 w-5" />
                  Generate Intelligence
                </>
              )}
            </Button>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            <Card className="aegis-card min-h-[600px]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Generated Content</CardTitle>
                    <CardDescription>Aegis intelligence output</CardDescription>
                  </div>
                {generatedScript && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSaveEpisode}>
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleEdit}
                      >
                        {isEditing ? <Check className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadScript}
                        title="Download Script"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateAudio()}
                        disabled={isGeneratingAudio}
                        title="Generate Audio"
                      >
                        {isGeneratingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      {audioBlob && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAudio}
                          title="Download Audio for Buzzsprout"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {audioUrl && (
                  <div className="mb-4 p-4 bg-accent rounded-lg">
                    <audio controls className="w-full">
                      <source src={audioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
                
                {generatedScript ? (
                  isEditing ? (
                    <Textarea
                      value={editableScript}
                      onChange={(e) => setEditableScript(e.target.value)}
                      className="min-h-[500px] font-sans text-sm leading-relaxed bg-background resize-none"
                      placeholder="Edit your script here..."
                    />
                  ) : (
                    <div className="prose prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground bg-transparent p-0">
                        {generatedScript}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Mic className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Configure parameters and generate to receive<br />
                      strategic intelligence from Aegis.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feedback Section - Show after episode is saved */}
            {currentEpisodeId && (
              <EpisodeFeedback episodeId={currentEpisodeId} />
            )}

            {/* Marketing Assets Section */}
            <MarketingAssets 
              script={isEditing ? editableScript : generatedScript} 
              topic={config.topic}
              episodeId={currentEpisodeId || undefined}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
