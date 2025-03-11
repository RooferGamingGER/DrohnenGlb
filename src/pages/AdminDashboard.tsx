
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Navigate } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

const AdminDashboard = () => {
  const { user, users, createUser, deleteUser } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Wenn kein Admin-Benutzer, zur Startseite umleiten
  if (!user?.isAdmin) {
    return <Navigate to="/" />;
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newUsername.trim() === '' || newPassword.trim() === '') {
      toast({
        title: "Fehler",
        description: "Benutzername und Passwort dürfen nicht leer sein.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const success = createUser(newUsername, newPassword, isAdmin);
    
    setIsLoading(false);
    
    if (success) {
      toast({
        title: "Benutzer erstellt",
        description: `Benutzer "${newUsername}" wurde erfolgreich erstellt.`,
      });
      // Formular zurücksetzen
      setNewUsername('');
      setNewPassword('');
      setIsAdmin(false);
    } else {
      toast({
        title: "Fehler",
        description: "Der Benutzername existiert bereits oder Sie haben keine Admin-Rechte.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = (userId: string, username: string) => {
    // Prüfen, ob es der aktuell eingeloggte Benutzer ist
    if (userId === user?.id) {
      toast({
        title: "Fehler",
        description: "Sie können Ihren eigenen Account nicht löschen.",
        variant: "destructive",
      });
      return;
    }

    // Bestätigung vom Benutzer einholen
    if (window.confirm(`Möchten Sie den Benutzer "${username}" wirklich löschen?`)) {
      const success = deleteUser(userId);
      
      if (success) {
        toast({
          title: "Benutzer gelöscht",
          description: `Benutzer "${username}" wurde erfolgreich gelöscht.`,
        });
      } else {
        toast({
          title: "Fehler",
          description: "Der Benutzer konnte nicht gelöscht werden.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-bold mb-4">Benutzer erstellen</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Benutzername
                </label>
                <Input
                  id="username"
                  placeholder="Neuen Benutzernamen eingeben"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Passwort
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Passwort eingeben"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="isAdmin"
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                />
                <label htmlFor="isAdmin" className="text-sm font-medium cursor-pointer">
                  Admin-Rechte gewähren
                </label>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Erstelle Benutzer..." : "Benutzer erstellen"}
              </Button>
            </form>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-bold mb-4">Benutzerliste</h2>
            <div className="overflow-auto max-h-[400px]">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Benutzername</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rolle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-sm">{user.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                      <td className="px-4 py-3 text-sm">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Benutzer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          title="Benutzer löschen"
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
