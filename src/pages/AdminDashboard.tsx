
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Navigate } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { Trash2, Eye, EyeOff, Save, Edit } from "lucide-react";

const AdminDashboard = () => {
  const { user, users, createUser, deleteUser, updateUser, isLoading } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // State für die Bearbeitung
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    username: string;
    password: string;
  }>({ username: '', password: '' });

  // Wenn noch geladen wird, zeigen wir einen Ladezustand
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Lädt...
      </div>
    );
  }

  // Wenn kein Admin-Benutzer, zur Startseite umleiten
  if (!user?.isAdmin) {
    return <Navigate to="/" />;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (newUsername.trim() === '' || newPassword.trim() === '') {
      toast({
        title: "Fehler",
        description: "Benutzername und Passwort dürfen nicht leer sein.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const success = await createUser(newUsername, newPassword, isAdmin);
      
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
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
      console.error("Fehler beim Erstellen des Benutzers:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (userItem: any) => {
    setEditingUser(userItem.id);
    setEditForm({
      username: userItem.username,
      password: '',
    });
  };

  const handleSaveEdit = async (userId: string) => {
    setIsSubmitting(true);
    
    try {
      const updates: { username?: string; password?: string } = {};
      const currentUser = users.find(u => u.id === userId);
      
      if (!currentUser) {
        setIsSubmitting(false);
        return;
      }

      // Nur Änderungen hinzufügen, die tatsächlich geändert wurden
      if (editForm.username && editForm.username !== currentUser.username) {
        updates.username = editForm.username;
      }
      if (editForm.password) {
        updates.password = editForm.password;
      }

      if (Object.keys(updates).length > 0) {
        const success = await updateUser(userId, updates);
        if (success) {
          toast({
            title: "Benutzer aktualisiert",
            description: "Die Änderungen wurden erfolgreich gespeichert.",
          });
        } else {
          toast({
            title: "Fehler",
            description: "Die Änderungen konnten nicht gespeichert werden.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
      console.error("Fehler beim Aktualisieren des Benutzers:", error);
    } finally {
      setIsSubmitting(false);
      setEditingUser(null);
      setShowPassword(null);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
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
      setIsSubmitting(true);
      
      try {
        const success = await deleteUser(userId);
        
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
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
          variant: "destructive",
        });
        console.error("Fehler beim Löschen des Benutzers:", error);
      } finally {
        setIsSubmitting(false);
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="isAdmin"
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                  disabled={isSubmitting}
                />
                <label htmlFor="isAdmin" className="text-sm font-medium cursor-pointer">
                  Admin-Rechte gewähren
                </label>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Erstelle Benutzer..." : "Benutzer erstellen"}
              </Button>
            </form>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-bold mb-4">Benutzerliste</h2>
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Keine Benutzer gefunden.</p>
            ) : (
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
                    {users.map((userItem) => (
                      <tr key={userItem.id}>
                        <td className="px-4 py-3 text-sm">
                          {userItem.id}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingUser === userItem.id ? (
                            <Input
                              value={editForm.username}
                              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                              className="w-full"
                              disabled={isSubmitting}
                            />
                          ) : (
                            userItem.username
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {userItem.isAdmin ? (
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
                          <div className="flex items-center gap-2">
                            {editingUser === userItem.id ? (
                              <>
                                <Input
                                  type={showPassword === userItem.id ? "text" : "password"}
                                  value={editForm.password}
                                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                  placeholder="Neues Passwort"
                                  className="w-32"
                                  disabled={isSubmitting}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowPassword(showPassword === userItem.id ? null : userItem.id)}
                                  title={showPassword === userItem.id ? "Passwort verbergen" : "Passwort anzeigen"}
                                  disabled={isSubmitting}
                                >
                                  {showPassword === userItem.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveEdit(userItem.id)}
                                  title="Änderungen speichern"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  disabled={isSubmitting}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(userItem)}
                                title="Benutzer bearbeiten"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                disabled={isSubmitting}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                              title="Benutzer löschen"
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
