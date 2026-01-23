import { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, Send, Check, ExternalLink, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Apple Podcasts show URL - update this with your actual show ID
const APPLE_PODCASTS_URL = "https://podcasts.apple.com/podcast/id";

interface EpisodeFeedbackProps {
  episodeId: string;
  onFeedbackSubmitted?: () => void;
}

export function EpisodeFeedback({ episodeId, onFeedbackSubmitted }: EpisodeFeedbackProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [whatWorked, setWhatWorked] = useState('');
  const [whatDidntWork, setWhatDidntWork] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!user || !episodeId || rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('episode_feedback').insert({
        episode_id: episodeId,
        user_id: user.id,
        rating,
        what_worked: whatWorked.trim() || null,
        what_didnt_work: whatDidntWork.trim() || null,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Feedback Submitted',
        description: 'Aegis will learn from your input to improve future episodes.',
      });

      onFeedbackSubmitted?.();
    } catch (error) {
      console.error('Feedback error:', error);
      toast({
        title: 'Failed to Submit',
        description: 'Could not save feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="aegis-card border-primary/20 bg-primary/5">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center justify-center gap-3 text-primary">
            <Check className="h-5 w-5" />
            <span className="font-medium">Thank you! Aegis is learning from your feedback.</span>
          </div>
          
          {rating >= 4 && (
            <div className="pt-4 border-t border-border/50">
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Loved this episode? Help others discover The Fortified Podcast!
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(APPLE_PODCASTS_URL, '_blank')}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                  </svg>
                  Leave a Review on Apple Podcasts
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isExpanded) {
    return (
      <Card className="aegis-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">How was this episode?</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      setRating(star);
                      setIsExpanded(true);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5 transition-colors',
                        (hoverRating || rating) >= star
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground/50'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="text-xs"
            >
              Add detailed feedback
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="aegis-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          Help Aegis Improve
        </CardTitle>
        <CardDescription>
          Your feedback trains Aegis to generate better content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Star Rating */}
        <div className="space-y-2">
          <Label>Overall Rating</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'h-7 w-7 transition-colors',
                    (hoverRating || rating) >= star
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'text-muted-foreground/50'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* What Worked */}
        <div className="space-y-2">
          <Label htmlFor="what-worked" className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-green-500" />
            What worked well?
          </Label>
          <Textarea
            id="what-worked"
            placeholder="e.g., Great storytelling, compelling hook, real examples..."
            value={whatWorked}
            onChange={(e) => setWhatWorked(e.target.value)}
            className="bg-background min-h-[80px]"
          />
        </div>

        {/* What Didn't Work */}
        <div className="space-y-2">
          <Label htmlFor="what-didnt-work" className="flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-red-500" />
            What could be better?
          </Label>
          <Textarea
            id="what-didnt-work"
            placeholder="e.g., Too long, unclear structure, needs more examples..."
            value={whatDidntWork}
            onChange={(e) => setWhatDidntWork(e.target.value)}
            className="bg-background min-h-[80px]"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="flex-1"
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Feedback
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsExpanded(false)}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
