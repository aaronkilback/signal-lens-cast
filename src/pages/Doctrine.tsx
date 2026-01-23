import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface DoctrineDocument {
  id: string;
  title: string;
  content: string;
  document_type: string;
  created_at: string;
}

export default function Doctrine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DoctrineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    content: '',
    document_type: 'doctrine',
  });

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('doctrine_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newDoc.title.trim() || !newDoc.content.trim() || !user) {
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
        user_id: user.id,
        title: newDoc.title,
        content: newDoc.content,
        document_type: newDoc.document_type,
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
      setDocuments([data, ...documents]);
      setNewDoc({ title: '', content: '', document_type: 'doctrine' });
      setIsDialogOpen(false);
      toast({
        title: 'Document Added',
        description: 'Doctrine document has been saved.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('doctrine_documents').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the document.',
        variant: 'destructive',
      });
    } else {
      setDocuments(documents.filter(d => d.id !== id));
      toast({
        title: 'Document Deleted',
        description: 'Removed from doctrine library.',
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'doctrine': return 'Doctrine';
      case 'framework': return 'Framework';
      case 'reference': return 'Reference';
      default: return type;
    }
  };

  return (
    <AppLayout>
      <div className="container py-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-semibold">Doctrine Library</h1>
            </div>
            <p className="text-muted-foreground">
              Manage Silent Shield doctrine and Fortress Framework documentation.
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Doctrine Document</DialogTitle>
                <DialogDescription>
                  Upload Silent Shield doctrine content that Aegis will reference during generation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
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
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Paste or type the doctrine content here..."
                    value={newDoc.content}
                    onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                    className="min-h-[300px]"
                  />
                </div>

                <Button onClick={handleCreate} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Save Document
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="aegis-card animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <Card className="aegis-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">No Doctrine Documents</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Add Silent Shield doctrine and Fortress Framework content for Aegis to reference 
                when generating intelligence.
              </p>
              <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((doc) => (
              <Card key={doc.id} className="aegis-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{doc.title}</CardTitle>
                      <CardDescription>
                        {getTypeLabel(doc.document_type)} • {new Date(doc.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Information Card */}
        <Card className="aegis-card aegis-section-border mt-8 pl-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg">How Doctrine Works</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3">
            <p>
              Documents uploaded here become part of Aegis's contextual knowledge. When generating 
              content, Aegis will intelligently weave these principles into every episode.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Doctrine:</strong> Core principles and philosophies</li>
              <li><strong>Framework:</strong> Structured methodologies (e.g., Fortress Framework)</li>
              <li><strong>Reference:</strong> Supporting materials and case studies</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
