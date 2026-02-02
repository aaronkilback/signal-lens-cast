import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FortressAgentSelector } from '@/components/fortress/FortressAgentSelector';
import { AgentInterviewStudio } from '@/components/fortress/AgentInterviewStudio';
import { FortressAgent } from '@/hooks/useFortressAgents';
import { useToast } from '@/hooks/use-toast';
import { Bot, FileText, Radio } from 'lucide-react';

interface TranscriptEntry {
  role: 'aegis' | 'agent';
  text: string;
  timestamp: Date;
}

export default function FortressAgents() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<FortressAgent | null>(null);
  const [showInterview, setShowInterview] = useState(false);
  const [completedTranscript, setCompletedTranscript] = useState<TranscriptEntry[] | null>(null);

  const handleStartInterview = () => {
    if (!selectedAgent) {
      toast({
        title: 'Select an Agent',
        description: 'Please select a Fortress agent to interview.',
        variant: 'destructive',
      });
      return;
    }
    setShowInterview(true);
    setCompletedTranscript(null);
  };

  const handleInterviewComplete = (transcript: TranscriptEntry[]) => {
    setCompletedTranscript(transcript);
    setShowInterview(false);
    
    if (transcript.length > 0) {
      toast({
        title: 'Interview Complete',
        description: `Captured ${transcript.length} conversation exchanges.`,
      });
    }
  };

  const handleExportAsScript = () => {
    if (!completedTranscript || !selectedAgent) return;
    
    const script = completedTranscript
      .map(entry => {
        const label = entry.role === 'aegis' ? '[AEGIS]' : `[${selectedAgent.codename.toUpperCase()}]`;
        return `${label}: ${entry.text}`;
      })
      .join('\n\n');
    
    navigator.clipboard.writeText(script);
    toast({
      title: 'Script Copied',
      description: 'The interview script has been copied to your clipboard.',
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Fortress Agent Interviews
          </h1>
          <p className="text-muted-foreground mt-2">
            Aegis interviews AI specialists from the Fortress intelligence network
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Agent Selection Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  Select Agent
                </CardTitle>
                <CardDescription>
                  Choose a Fortress agent for Aegis to interview
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FortressAgentSelector
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                />

                {!showInterview && selectedAgent && (
                  <Button
                    onClick={handleStartInterview}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Radio className="h-4 w-4" />
                    Start AI Interview
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Completed Transcript Actions */}
            {completedTranscript && completedTranscript.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Interview Recording
                  </CardTitle>
                  <CardDescription>
                    {completedTranscript.length} exchanges captured
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleExportAsScript}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Copy as Script
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Copy the transcript in script format for use in the Generate page
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Interview Panel */}
          <div className="lg:col-span-2 min-h-[600px]">
            {showInterview && selectedAgent ? (
              <AgentInterviewStudio
                agent={selectedAgent}
                onComplete={handleInterviewComplete}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">AI-to-AI Interviews</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Select a Fortress agent on the left to start an interview.
                    Aegis will conduct a real-time conversation with the agent
                    to extract their specialized knowledge.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
