import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DoctrineCard } from '@/components/doctrine/DoctrineCard';
import { DoctrineCreateDialog } from '@/components/doctrine/DoctrineCreateDialog';

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

export default function Doctrine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DoctrineDocument[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDocumentCreated = (doc: DoctrineDocument) => {
    setDocuments([doc, ...documents]);
  };

  const handleDelete = async (id: string) => {
    // Find the document to get file path for cleanup
    const docToDelete = documents.find(d => d.id === id);
    
    const { error } = await supabase.from('doctrine_documents').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the document.',
        variant: 'destructive',
      });
    } else {
      // Also delete file from storage if exists
      if (docToDelete?.file_path) {
        await supabase.storage.from('doctrine-files').remove([docToDelete.file_path]);
      }
      
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

          {user && (
            <DoctrineCreateDialog
              userId={user.id}
              onDocumentCreated={handleDocumentCreated}
            />
          )}
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
              {user && (
                <div className="mt-6">
                  <DoctrineCreateDialog
                    userId={user.id}
                    onDocumentCreated={handleDocumentCreated}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((doc) => (
              <DoctrineCard
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                getTypeLabel={getTypeLabel}
              />
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
