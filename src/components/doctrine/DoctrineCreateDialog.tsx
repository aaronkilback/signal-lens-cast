import { useState } from 'react';
import { Plus, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DoctrineFileUploader } from './DoctrineFileUploader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NewDocData {
  title: string;
  content: string;
  document_type: string;
  file_path?: string;
  file_name?: string;
  file_type?: string;
  file_size_bytes?: number;
  extracted_text?: string;
}

interface DoctrineCreateDialogProps {
  userId: string;
  onDocumentCreated: (doc: any) => void;
  onDocumentsCreated?: (docs: any[]) => void;
}

export function DoctrineCreateDialog({ userId, onDocumentCreated, onDocumentsCreated }: DoctrineCreateDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'upload'>('text');
  const [uploadedFiles, setUploadedFiles] = useState<NewDocData[]>([]);
  const [newDoc, setNewDoc] = useState<NewDocData>({
    title: '',
    content: '',
    document_type: 'doctrine',
  });

  const resetForm = () => {
    setNewDoc({
      title: '',
      content: '',
      document_type: 'doctrine',
    });
    setUploadedFiles([]);
    setActiveTab('text');
  };

  const handleCreate = async () => {
    if (!newDoc.title.trim() || !newDoc.content.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('doctrine_documents')
      .insert({
        user_id: userId,
        title: newDoc.title,
        content: newDoc.content,
        document_type: newDoc.document_type,
        file_path: newDoc.file_path || null,
        file_name: newDoc.file_name || null,
        file_type: newDoc.file_type || null,
        file_size_bytes: newDoc.file_size_bytes || null,
        extracted_text: newDoc.extracted_text || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      onDocumentCreated(data);
      resetForm();
      setIsOpen(false);
      toast({
        title: 'Document Added',
        description: 'Doctrine document has been saved.',
      });
    }
  };

  const handleFileProcessed = async (result: {
    content: string;
    extractedText?: string;
    filePath: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
  }) => {
    // Auto-generate title from filename
    const titleFromFile = result.fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    // Create document immediately for batch uploads
    const { data, error } = await supabase
      .from('doctrine_documents')
      .insert({
        user_id: userId,
        title: titleFromFile,
        content: result.content,
        document_type: 'reference', // Default for batch uploads
        file_path: result.filePath,
        file_name: result.fileName,
        file_type: result.fileType,
        file_size_bytes: result.fileSizeBytes,
        extracted_text: result.extractedText || null,
      })
      .select()
      .single();

    if (!error && data) {
      onDocumentCreated(data);
    }
  };

  const handleBatchComplete = () => {
    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Doctrine Document</DialogTitle>
          <DialogDescription>
            Upload files or paste content that Aegis will reference during generation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'upload')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <DoctrineFileUploader
              userId={userId}
              onFileProcessed={handleFileProcessed}
              onBatchComplete={handleBatchComplete}
              onCancel={() => setActiveTab('text')}
            />
          </TabsContent>

          <TabsContent value="text" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Fortress Framework Principles"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Document Type</Label>
              <Select
                value={newDoc.document_type}
                onValueChange={(value) => setNewDoc({ ...newDoc, document_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctrine">Doctrine</SelectItem>
                  <SelectItem value="framework">Framework</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Content</Label>
                {newDoc.file_name && (
                  <span className="text-xs text-muted-foreground">
                    From: {newDoc.file_name}
                  </span>
                )}
              </div>
              <Textarea
                id="content"
                placeholder="Paste or type the doctrine content here..."
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                className="min-h-[250px]"
              />
            </div>

            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Save Document
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
