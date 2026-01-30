import { useState, useCallback } from 'react';
import { Upload, FileText, Image, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DoctrineFileUploaderProps {
  userId: string;
  onFileProcessed: (result: {
    content: string;
    extractedText?: string;
    filePath: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
  }) => void;
  onCancel: () => void;
}

const ACCEPTED_TYPES = {
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function DoctrineFileUploader({ userId, onFileProcessed, onCancel }: DoctrineFileUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'extracting'>('idle');

  const isDocument = (fileName: string) => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return ACCEPTED_TYPES.documents.includes(ext);
  };

  const isImage = (fileName: string) => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return ACCEPTED_TYPES.images.includes(ext);
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // For plain text files, read directly
    if (['txt', 'md'].includes(ext || '')) {
      return await file.text();
    }
    
    // For PDFs and other documents, we'd ideally use a parsing service
    // For now, return empty and let user paste/edit content manually
    return '';
  };

  const processFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 50MB.',
        variant: 'destructive',
      });
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allAccepted = [...ACCEPTED_TYPES.documents, ...ACCEPTED_TYPES.images];
    
    if (!allAccepted.includes(ext)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a document (PDF, Word, TXT) or image (PNG, JPG).',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setStatus('uploading');
    setProgress(0);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}-${safeName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('doctrine-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setProgress(50);

      // Extract text for documents
      let extractedText = '';
      if (isDocument(file.name)) {
        setStatus('extracting');
        extractedText = await extractTextFromFile(file);
        setProgress(80);
      }

      setProgress(100);

      // Determine initial content
      let content = '';
      if (isImage(file.name)) {
        content = `[Image: ${file.name}]`;
      } else if (extractedText) {
        content = extractedText;
      } else {
        content = `[Document: ${file.name}] - Content pending extraction`;
      }

      onFileProcessed({
        content,
        extractedText: extractedText || undefined,
        filePath,
        fileName: file.name,
        fileType: file.type || ext.slice(1),
        fileSizeBytes: file.size,
      });

      toast({
        title: 'File Uploaded',
        description: isDocument(file.name) 
          ? 'Document uploaded. You can edit the extracted content below.'
          : 'Image uploaded successfully.',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Could not upload file.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {status === 'uploading' ? 'Uploading file...' : 'Extracting text...'}
            </p>
            <Progress value={progress} className="max-w-xs mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Image className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm font-medium mb-1">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Documents: PDF, Word, TXT, Markdown • Images: PNG, JPG, GIF
            </p>
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept={[...ACCEPTED_TYPES.documents, ...ACCEPTED_TYPES.images].join(',')}
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={uploading}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
