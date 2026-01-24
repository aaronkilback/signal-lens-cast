import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Video, RefreshCw, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface GuestOnboardingProps {
  guestName: string;
  topic?: string;
  onComplete: () => void;
}

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to Your Interview',
    description: 'You\'ll be having a conversation with Aegis, an AI host who specializes in strategic security discussions.',
    icon: '🎙️',
    details: [
      'Aegis will introduce you based on your background',
      'The conversation will be natural and engaging',
      'Feel free to share your expertise and insights',
    ],
  },
  {
    title: 'Audio & Video Setup',
    description: 'We\'ll record both your voice and video for a split-screen interview format.',
    icon: '📹',
    details: [
      'Make sure you\'re in a quiet environment',
      'Good lighting helps (face a window if possible)',
      'Use headphones to avoid echo',
    ],
  },
  {
    title: 'Segment-Based Recording',
    description: 'Don\'t worry about mistakes! You can re-record any section.',
    icon: '🔄',
    details: [
      'The interview is divided into segments',
      'If you stumble, just mark that section for re-recording',
      'You can review and select the best takes',
    ],
  },
  {
    title: 'Your Call-to-Action',
    description: 'Promote yourself! Add a link or message for viewers.',
    icon: '📣',
    details: [
      'Share your social media handles',
      'Promote a product, service, or website',
      'This will appear in the final video',
    ],
  },
];

export function GuestOnboarding({ guestName, topic, onComplete }: GuestOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const step = ONBOARDING_STEPS[currentStep];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center gap-1 mb-4">
            {ONBOARDING_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  idx <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="text-4xl mb-2">{step.icon}</div>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {currentStep === 0 && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Prepared for</p>
              <p className="font-semibold text-lg">{guestName}</p>
              {topic && (
                <Badge variant="secondary" className="mt-2">
                  {topic}
                </Badge>
              )}
            </div>
          )}

          <ul className="space-y-3">
            {step.details.map((detail, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">{detail}</span>
              </li>
            ))}
          </ul>

          {currentStep === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Mic className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Microphone</p>
                <p className="text-xs text-muted-foreground">Required</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Video className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Camera</p>
                <p className="text-xs text-muted-foreground">Required</p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
              <RefreshCw className="h-10 w-10 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Unlimited Retakes</p>
                <p className="text-xs text-muted-foreground">
                  Re-record any segment until you're happy with it
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              onClick={() => isLastStep ? onComplete() : setCurrentStep(currentStep + 1)}
              className="flex-1 gap-2"
            >
              {isLastStep ? 'Get Started' : 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
