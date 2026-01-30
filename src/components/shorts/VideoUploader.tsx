import { useState, useRef, useCallback } from 'react';
import { Upload, Video, Loader2, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { VideoUpload } from '@/pages/Shorts';

interface VideoUploaderProps {
  onVideoUploaded: (video: VideoUpload) => void;
}

// Max file size: 2GB (Supabase supports up to 5GB with chunked uploads)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export function VideoUploader({ onVideoUploaded }: VideoUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'transcribing' | 'done' | 'error'>('idle');
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a video file (MP4, MOV, WebM, etc.)',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast({
        title: 'File Too Large',
        description: `Maximum file size is 2GB. Your file is ${formatFileSize(selectedFile.size)}`,
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  }, [title, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }, [title]);

  const handleUpload = async () => {
    if (!file || !user || !title.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a video and enter a title',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadStage('uploading');
    setUploadProgress(0);

    const startTime = Date.now();

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${user.id}/${fileName}`;

      // Track progress for large files
      const isLargeFile = file.size > 50 * 1024 * 1024;
      let progressInterval: NodeJS.Timeout | null = null;
      
      if (isLargeFile) {
        progressInterval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const estimatedSpeed = 2 * 1024 * 1024; // ~2MB/s estimate
          const estimatedProgress = Math.min(55, (elapsed * estimatedSpeed / file.size) * 55);
          setUploadProgress(estimatedProgress);
          
          const remaining = (file.size / estimatedSpeed) - elapsed;
          if (remaining > 60) {
            setTimeRemaining(`~${Math.ceil(remaining / 60)} min remaining`);
          } else if (remaining > 0) {
            setTimeRemaining(`~${Math.ceil(remaining)} sec remaining`);
          }
          setUploadSpeed(`~${(estimatedSpeed / (1024 * 1024)).toFixed(1)} MB/s`);
        }, 500);
      }

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (progressInterval) clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setUploadProgress(60);
      setUploadStage('processing');
      setUploadSpeed('');
      setTimeRemaining('');

      const { data: videoRecord, error: dbError } = await supabase
        .from('video_uploads')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          original_filename: file.name,
          storage_path: storagePath,
          file_size_bytes: file.size,
          mime_type: file.type,
          status: 'uploaded',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(80);
      setUploadStage('transcribing');

      // Start transcription in background
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          videoId: videoRecord.id,
          storagePath,
        }),
      }).catch(err => console.error('Transcription request failed:', err));

      setUploadProgress(100);
      setUploadStage('done');

      setFile(null);
      setTitle('');
      setDescription('');
      setUploadSpeed('');
      setTimeRemaining('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onVideoUploaded(videoRecord);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload video',
        variant: 'destructive',
      });
      setUploadStage('error');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        {file ? (
          <div className="flex items-center justify-center gap-4">
            <Video className="h-10 w-10 text-primary" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
                {file.size > 100 * 1024 * 1024 && (
                  <span className="ml-2 text-amber-500">(large file - may take a few minutes)</span>
                )}
              </p>
            </div>
            {!isUploading && (
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">Drop your video here</p>
            <p className="text-sm text-muted-foreground mb-4">
              MP4, MOV, WebM up to 2GB
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Select Video
            </Button>
          </>
        )}
      </div>

      {file && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              disabled={isUploading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the video content"
              rows={3}
              disabled={isUploading}
            />
          </div>
        </div>
      )}

      {isUploading && (
        <div className="space-y-3">
          <Progress value={uploadProgress} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {uploadStage === 'uploading' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading video...</span>
                </>
              )}
              {uploadStage === 'processing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              )}
              {uploadStage === 'transcribing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Starting transcription...</span>
                </>
              )}
              {uploadStage === 'done' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Upload complete!</span>
                </>
              )}
              {uploadStage === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">Upload failed</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              {uploadSpeed && <span>{uploadSpeed}</span>}
              {timeRemaining && <span>{timeRemaining}</span>}
            </div>
          </div>
        </div>
      )}

      {file && !isUploading && uploadStage !== 'done' && (
        <Button onClick={handleUpload} className="w-full" size="lg">
          <Upload className="h-4 w-4 mr-2" />
          Upload & Transcribe
        </Button>
      )}
    </div>
  );
}
