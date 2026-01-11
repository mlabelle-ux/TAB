import { useState } from 'react';
import { createAbsence, deleteAbsence } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Trash2, UserX, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function AbsencesPage({ absences, employees, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const sortedAbsences = [...absences].sort((a, b) => 
    new Date(b.start_date) - new Date(a.start_date)
  );

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const isCurrentAbsence = (absence) => {
    const today = new Date().toISOString().split('T')[0];
    return absence.start_date <= today && absence.end_date >= today;
  };

  const isFutureAbsence = (absence) => {
    const today = new Date().toISOString().split('T')[0];
    return absence.start_date > today;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    try {
      await createAbsence(formData);
      toast.success('Absence enregistrée - Les assignations ont été désassignées automatiquement');
      setShowModal(false);
      setFormData({ employee_id: '', start_date: '', end_date: '', reason: '' });
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (absence) => {
    if (!window.confirm(`Supprimer l'absence de ${absence.employee_name}?`)) return;
    
    try {
      await deleteAbsence(absence.id);
      toast.success('Absence supprimée - Les assignations sont de nouveau actives');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div data-testid="absences-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Gestion des absences
            <Badge variant="secondary">{absences.length}</Badge>
          </CardTitle>
          <Button 
            onClick={() => setShowModal(true)} 
            className="bg-[#4CAF50] hover:bg-[#43A047]" 
            data-testid="add-absence-btn"
          >
            <Plus className="h-4 w-4 mr-1" />
            Déclarer une absence
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAbsences.map((absence) => (
                  <TableRow key={absence.id} data-testid={`absence-row-${absence.id}`}>
                    <TableCell className="font-medium">{absence.employee_name}</TableCell>
                    <TableCell>{formatDateDisplay(absence.start_date)}</TableCell>
                    <TableCell>{formatDateDisplay(absence.end_date)}</TableCell>
                    <TableCell className="max-w-xs truncate">{absence.reason || '-'}</TableCell>
                    <TableCell>
                      {isCurrentAbsence(absence) ? (
                        <Badge variant="destructive">En cours</Badge>
                      ) : isFutureAbsence(absence) ? (
                        <Badge variant="secondary">À venir</Badge>
                      ) : (
                        <Badge variant="outline">Terminée</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(absence)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-absence-${absence.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedAbsences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune absence enregistrée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Absence Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Déclarer une absence
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Employé *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(v) => setFormData({ ...formData, employee_id: v })}
              >
                <SelectTrigger data-testid="absence-employee-select">
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  data-testid="absence-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  data-testid="absence-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Raison (optionnel)</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Ex: Maladie, Vacances, Formation..."
                rows={3}
                data-testid="absence-reason"
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Les assignations, quarts et blocs de travail de cet employé 
                seront automatiquement désassignés pendant cette période et apparaîtront dans 
                la section "Remplacements".
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="save-absence-btn">
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
