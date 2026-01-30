import { useState, useCallback } from 'react';
import { Upload, FileText, Image, X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FileResult {
  content: string;
  extractedText?: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

interface DoctrineFileUploaderProps {
  userId: string;
  onFileProcessed: (result: FileResult) => void;
  onBatchComplete?: () => void;
  onCancel: () => void;
}

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'done' | 'error';
  progress: number;
  error?: string;
}

const ACCEPTED_TYPES = {
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function DoctrineFileUploader({ userId, onFileProcessed, onBatchComplete, onCancel }: DoctrineFileUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
    if (['txt', 'md'].includes(ext || '')) {
      return await file.text();
    }
    return '';
  };

  const updateFileState = (index: number, updates: Partial<FileUploadState>) => {
    setFileStates(prev => prev.map((fs, i) => i === index ? { ...fs, ...updates } : fs));
  };

  const processFile = async (file: File, index: number): Promise<boolean> => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    try {
      updateFileState(index, { status: 'uploading', progress: 10 });

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('doctrine-files')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;
      updateFileState(index, { progress: 50 });

      let extractedText = '';
      if (isDocument(file.name)) {
        updateFileState(index, { status: 'extracting' });
        extractedText = await extractTextFromFile(file);
      }
      updateFileState(index, { progress: 80 });

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

      updateFileState(index, { status: 'done', progress: 100 });
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      updateFileState(index, { status: 'error', error: error instanceof Error ? error.message : 'Upload failed' });
      return false;
    }
  };

  const processAllFiles = async (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'File Too Large', description: `${file.name} exceeds 50MB limit.`, variant: 'destructive' });
        return false;
      }
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const allAccepted = [...ACCEPTED_TYPES.documents, ...ACCEPTED_TYPES.images];
      if (!allAccepted.includes(ext)) {
        toast({ title: 'Invalid File', description: `${file.name} is not a supported format.`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setFileStates(validFiles.map(file => ({ file, status: 'pending', progress: 0 })));
    setIsProcessing(true);

    let successCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      const success = await processFile(validFiles[i], i);
      if (success) successCount++;
    }

    setIsProcessing(false);
    toast({
      title: 'Upload Complete',
      description: `${successCount} of ${validFiles.length} files uploaded successfully.`,
    });
    
    if (onBatchComplete) onBatchComplete();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processAllFiles(files);
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processAllFiles(files);
  };

  const totalProgress = fileStates.length > 0 
    ? Math.round(fileStates.reduce((sum, fs) => sum + fs.progress, 0) / fileStates.length)
    : 0;

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {fileStates.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium mb-2">
              {isProcessing ? 'Uploading files...' : 'Upload complete'}
            </p>
            {fileStates.map((fs, i) => (
              <div key={i} className="flex items-center gap-3 text-left text-sm">
                {fs.status === 'done' ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : fs.status === 'error' ? (
                  <X className="h-4 w-4 text-destructive flex-shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                )}
                <span className="truncate flex-1">{fs.file.name}</span>
                <span className="text-xs text-muted-foreground w-12 text-right">{fs.progress}%</span>
              </div>
            ))}
            <Progress value={totalProgress} className="mt-2" />
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
            <p className="text-sm font-medium mb-1">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Select multiple files • PDF, Word, TXT, Markdown, PNG, JPG, GIF
            </p>
            <input
              type="file"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept={[...ACCEPTED_TYPES.documents, ...ACCEPTED_TYPES.images].join(',')}
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>
          <X className="h-4 w-4 mr-2" />
          {fileStates.length > 0 && !isProcessing ? 'Done' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
