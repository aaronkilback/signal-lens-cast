import { useState, useCallback } from 'react';
import { FileText, List, MessageSquare, PenTool, BookOpen, Loader2, Copy, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';

interface MarketingAssetsProps {
  script: string;
  topic: string;
}

type AssetType = 'show_notes' | 'chapter_markers' | 'transcript' | 'social_posts' | 'blog_post';

interface AssetConfig {
  id: AssetType;
  label: string;
  icon: typeof FileText;
  description: string;
}

const ASSET_CONFIGS: AssetConfig[] = [
  { id: 'show_notes', label: 'Show Notes', icon: FileText, description: 'Episode description, key takeaways, and resources' },
  { id: 'chapter_markers', label: 'Chapter Markers', icon: List, description: 'Timestamped chapter list for podcast players' },
  { id: 'transcript', label: 'Full Transcript', icon: BookOpen, description: 'Formatted transcript for accessibility and SEO' },
  { id: 'social_posts', label: 'Social Posts', icon: MessageSquare, description: 'LinkedIn, Twitter, Instagram, and Facebook posts' },
  { id: 'blog_post', label: 'Blog Post', icon: PenTool, description: '800-1200 word article version of the episode' },
];

export function MarketingAssets({ script, topic }: MarketingAssetsProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Record<AssetType, string>>({
    show_notes: '',
    chapter_markers: '',
    transcript: '',
    social_posts: '',
    blog_post: '',
  });
  const [loading, setLoading] = useState<Record<AssetType, boolean>>({
    show_notes: false,
    chapter_markers: false,
    transcript: false,
    social_posts: false,
    blog_post: false,
  });

  const generateAsset = useCallback(async (assetType: AssetType) => {
    if (!script) {
      toast({
        title: 'No Script',
        description: 'Generate a script first before creating marketing assets.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(prev => ({ ...prev, [assetType]: true }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-marketing-assets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ script, topic, assetType }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate asset');
      }

      const data = await response.json();
      setAssets(prev => ({ ...prev, [assetType]: data.content }));

      toast({
        title: 'Asset Generated',
        description: `${ASSET_CONFIGS.find(c => c.id === assetType)?.label} is ready.`,
      });
    } catch (error) {
      console.error('Asset generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, [assetType]: false }));
    }
  }, [script, topic, toast]);

  const copyToClipboard = useCallback((content: string, label: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard.`,
    });
  }, [toast]);

  const downloadAsset = useCallback((content: string, assetType: AssetType) => {
    const config = ASSET_CONFIGS.find(c => c.id === assetType);
    const filename = `aegis-${assetType.replace(/_/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: `${config?.label} saved as ${filename}`,
    });
  }, [toast]);

  if (!script) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <PenTool className="h-4 w-4" />
        <span>Marketing Assets</span>
      </div>

      <Accordion type="multiple" className="w-full space-y-2">
        {ASSET_CONFIGS.map((config) => {
          const Icon = config.icon;
          const content = assets[config.id];
          const isLoading = loading[config.id];

          return (
            <AccordionItem
              key={config.id}
              value={config.id}
              className="border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left">
                  <Icon className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-muted-foreground">{config.description}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                {content ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(content, config.label)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadAsset(content, config.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateAsset(config.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Regenerate'
                        )}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-4 max-h-80 overflow-y-auto">
                      {content}
                    </pre>
                  </div>
                ) : (
                  <Button
                    onClick={() => generateAsset(config.id)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating {config.label}...
                      </>
                    ) : (
                      <>
                        <Icon className="h-4 w-4 mr-2" />
                        Generate {config.label}
                      </>
                    )}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
