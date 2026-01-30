import { useState } from 'react';
import { Film, Clock, FileText, Scissors, Loader2, RefreshCw, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { VideoUpload, VideoClip } from '@/pages/Shorts';

interface VideoLibraryProps {
  videos: VideoUpload[];
  clips: VideoClip[];
  isLoading: boolean;
  onVideoSelect: (video: VideoUpload) => void;
  onRefresh: () => void;
}

export function VideoLibrary({ videos, clips, isLoading, onVideoSelect, onRefresh }: VideoLibraryProps) {
  const { toast } = useToast();
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">Uploading</Badge>;
      case 'uploaded':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500">Processing</Badge>;
      case 'transcribed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">Ready</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = async () => {
    if (!deleteVideoId) return;
    
    setIsDeleting(true);
    try {
      const video = videos.find(v => v.id === deleteVideoId);
      if (!video) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('videos')
        .remove([video.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database (clips will cascade delete)
      const { error: dbError } = await supabase
        .from('video_uploads')
        .delete()
        .eq('id', deleteVideoId);

      if (dbError) throw dbError;

      toast({
        title: 'Video Deleted',
        description: 'The video and its clips have been removed.',
      });
      
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete the video',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteVideoId(null);
    }
  };

  const getClipCount = (videoId: string) => {
    return clips.filter(c => c.source_video_id === videoId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your Videos</h2>
          <p className="text-sm text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? 's' : ''} • {clips.length} clip{clips.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Videos Yet</h3>
            <p className="text-muted-foreground text-center">
              Upload your first video to get started creating shorts
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <div className="aspect-video bg-muted flex items-center justify-center">
                <Film className="h-12 w-12 text-muted-foreground" />
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-1">{video.title}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteVideoId(video.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {video.description || video.original_filename}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(video.duration_seconds)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{formatFileSize(video.file_size_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Scissors className="h-3.5 w-3.5" />
                    <span>{getClipCount(video.id)} clips</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {getStatusBadge(video.status)}
                  <Button
                    size="sm"
                    disabled={video.status !== 'transcribed'}
                    onClick={() => onVideoSelect(video)}
                  >
                    Create Clips
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteVideoId} onOpenChange={() => setDeleteVideoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the video and all clips created from it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
