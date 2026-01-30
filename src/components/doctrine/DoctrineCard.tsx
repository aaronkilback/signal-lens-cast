import { FileText, Image, File, Trash2, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DoctrineDocument {
  id: string;
  title: string;
  content: string;
  document_type: string;
  created_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size_bytes?: number | null;
}

interface DoctrineCardProps {
  doc: DoctrineDocument;
  onDelete: (id: string) => void;
  getTypeLabel: (type: string) => string;
}

export function DoctrineCard({ doc, onDelete, getTypeLabel }: DoctrineCardProps) {
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (fileType?: string | null) => {
    return fileType?.startsWith('image') || 
           ['png', 'jpg', 'jpeg', 'gif', 'webp'].some(ext => fileType?.includes(ext));
  };

  const handleDownload = async () => {
    if (!doc.file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from('doctrine-files')
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not generate download link.',
        variant: 'destructive',
      });
    }
  };

  const FileIcon = isImageFile(doc.file_type) ? Image : doc.file_path ? File : FileText;

  return (
    <Card className="aegis-card group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-lg truncate">{doc.title}</CardTitle>
            </div>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getTypeLabel(doc.document_type)}
              </Badge>
              <span className="text-xs">
                {new Date(doc.created_at).toLocaleDateString()}
              </span>
              {doc.file_name && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  • {doc.file_name}
                </span>
              )}
              {doc.file_size_bytes && (
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(doc.file_size_bytes)})
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {doc.file_path && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Download file"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(doc.id)}
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {doc.content}
        </p>
      </CardContent>
    </Card>
  );
}
