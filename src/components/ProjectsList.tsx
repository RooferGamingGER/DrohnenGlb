
import { useState, useEffect } from 'react';
import { getUserProjects, Project, deleteProject } from '@/services/projectService';
import { Loader2, Trash2, Calendar, FileIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/utils/modelUtils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface ProjectsListProps {
  onSelect: (projectId: string, fileUrl: string, measurements: any[]) => void;
}

const ProjectsList: React.FC<ProjectsListProps> = ({ onSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const projectsList = await getUserProjects();
      setProjects(projectsList);
    } catch (err) {
      console.error("Error loading projects:", err);
      setError("Fehler beim Laden der Projekte");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    onSelect(project.id, project.fileUrl, project.measurements || []);
  };

  const handleDeleteClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(projectId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    
    try {
      const success = await deleteProject(projectToDelete);
      if (success) {
        setProjects(projects.filter(p => p.id !== projectToDelete));
        toast({
          title: "Projekt gelöscht",
          description: "Das Projekt wurde erfolgreich gelöscht.",
        });
      } else {
        toast({
          title: "Fehler",
          description: "Beim Löschen ist ein Fehler aufgetreten.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      toast({
        title: "Fehler",
        description: "Beim Löschen ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
    
    setDeleteConfirmOpen(false);
    setProjectToDelete(null);
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <FileIcon className="w-12 h-12 text-muted-foreground mb-2" />
      <h3 className="font-medium mb-1">Keine Projekte gefunden</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Sie haben noch keine Projekte gespeichert. Laden Sie ein 3D-Modell hoch und speichern Sie es.
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Projekte werden geladen...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6 text-destructive">
        <p>{error}</p>
        <Button variant="outline" onClick={loadProjects} className="mt-2">
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {projects.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {projects.map((project) => (
            <div 
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="p-3 border rounded-md hover:border-primary cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium mb-1 truncate pr-4">{project.name}</h4>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>
                      {format(project.updatedAt.toDate(), 'dd.MM.yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(project.fileSize)}
                    </span>
                    {project.measurements && project.measurements.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
                        {project.measurements.length} Messungen
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(project.id, e)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie dieses Projekt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsList;
