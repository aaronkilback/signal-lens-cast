import { useState, useEffect } from 'react';
import { Mic, Loader2, Volume2, Download, FileText, Edit3, Check } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
}

const getInitialState = (): PersistedState => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load persisted state:', e);
  }
  return {
    config: {
      topic: '',
      targetAudience: 'executives',
      lifeDomains: ['executive_travel'],
      contentLength: 10,
      toneIntensity: 'strategic',
      outputMode: 'podcast_script',
      voice: 'onyx',
    },
    generatedScript: '',
    editableScript: '',
    toneValue: [50],
  };
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

  // Persist state to sessionStorage
  useEffect(() => {
    const stateToSave: PersistedState = {
      config,
      generatedScript,
      editableScript,
      toneValue,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [config, generatedScript, editableScript, toneValue]);

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

  const handleGenerateAudio = async () => {
    const scriptToUse = isEditing ? editableScript : generatedScript;
    
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
      // Save edits
      setGeneratedScript(editableScript);
      setIsEditing(false);
      
      toast({
        title: 'Script Updated',
        description: 'Regenerating audio with your edits...',
      });
      
      // Auto-regenerate audio with edited script
      await handleGenerateAudio();
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

      const { error } = await supabase.from('episodes').insert({
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
      });

      if (error) throw error;

      toast({
        title: 'Episode Saved',
        description: 'Added to your intelligence library.',
      });
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
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-semibold">Content Generator</h1>
          </div>
          <p className="text-muted-foreground">
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
                        onClick={handleGenerateAudio}
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
