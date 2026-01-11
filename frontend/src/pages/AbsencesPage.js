import { useState, useMemo } from 'react';
import { createAbsence, deleteAbsence } from '../lib/api';
import api from '../lib/api';
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
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Trash2, UserX, Calendar, Edit } from 'lucide-react';
import { toast } from 'sonner';

const SHIFT_TYPES = [
  { id: 'AM', label: 'AM (Matin)' },
  { id: 'MIDI', label: 'MIDI' },
  { id: 'PM', label: 'PM (Après-midi)' },
  { id: 'ADMIN', label: 'Admin' },
  { id: 'MECANO', label: 'Mécano' },
];

export default function AbsencesPage({ absences, employees, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    shift_types: [] // Empty = all shifts
  });
  const [allShifts, setAllShifts] = useState(true);

  // Trier les employés par ordre alphabétique
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

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

  const openAddModal = () => {
    setEditingAbsence(null);
    setFormData({
      employee_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: '',
      shift_types: []
    });
    setAllShifts(true);
    setShowModal(true);
  };

  const openEditModal = (absence) => {
    setEditingAbsence(absence);
    setFormData({
      employee_id: absence.employee_id,
      start_date: absence.start_date,
      end_date: absence.end_date,
      reason: absence.reason || '',
      shift_types: absence.shift_types || []
    });
    setAllShifts(!absence.shift_types || absence.shift_types.length === 0);
    setShowModal(true);
  };

  const handleShiftToggle = (shiftId) => {
    setAllShifts(false);
    setFormData(prev => ({
      ...prev,
      shift_types: prev.shift_types.includes(shiftId)
        ? prev.shift_types.filter(s => s !== shiftId)
        : [...prev.shift_types, shiftId]
    }));
  };

  const handleAllShiftsChange = (checked) => {
    setAllShifts(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, shift_types: [] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!editingAbsence && !formData.employee_id) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }
    
    if (!formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir les dates');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    const dataToSend = {
      ...formData,
      shift_types: allShifts ? [] : formData.shift_types
    };

    try {
      if (editingAbsence) {
        // Update existing absence
        await api.put(`/absences/${editingAbsence.id}`, {
          start_date: dataToSend.start_date,
          end_date: dataToSend.end_date,
          reason: dataToSend.reason,
          shift_types: dataToSend.shift_types
        });
        toast.success('Absence modifiée');
      } else {
        await createAbsence(dataToSend);
        toast.success('Absence enregistrée');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (absence) => {
    if (!window.confirm(`Supprimer l'absence de ${absence.employee_name}?`)) return;
    
    try {
      await deleteAbsence(absence.id);
      toast.success('Absence supprimée');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getShiftTypesDisplay = (shiftTypes) => {
    if (!shiftTypes || shiftTypes.length === 0) return 'Tous les quarts';
    return shiftTypes.join(', ');
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
            onClick={openAddModal} 
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
                  <TableHead>Quarts</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAbsences.map((absence) => (
                  <TableRow key={absence.id} data-testid={`absence-row-${absence.id}`}>
                    <TableCell className="font-medium">{absence.employee_name}</TableCell>
                    <TableCell>{formatDateDisplay(absence.start_date)}</TableCell>
                    <TableCell>{formatDateDisplay(absence.end_date)}</TableCell>
                    <TableCell className="text-sm">{getShiftTypesDisplay(absence.shift_types)}</TableCell>
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(absence)}
                          data-testid={`edit-absence-${absence.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(absence)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`delete-absence-${absence.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedAbsences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucune absence enregistrée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Absence Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingAbsence ? 'Modifier l\'absence' : 'Déclarer une absence'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingAbsence && (
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
            )}

            {editingAbsence && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-muted-foreground">Employé</Label>
                <p className="font-medium">{editingAbsence.employee_name}</p>
              </div>
            )}

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

            {/* Shift types selection */}
            <div className="space-y-3">
              <Label>Quarts concernés</Label>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="all-shifts"
                  checked={allShifts}
                  onCheckedChange={handleAllShiftsChange}
                />
                <label htmlFor="all-shifts" className="text-sm font-medium cursor-pointer">
                  Tous les quarts de travail
                </label>
              </div>
              
              {!allShifts && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
                  {SHIFT_TYPES.map(shift => (
                    <div key={shift.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`shift-${shift.id}`}
                        checked={formData.shift_types.includes(shift.id)}
                        onCheckedChange={() => handleShiftToggle(shift.id)}
                      />
                      <label htmlFor={`shift-${shift.id}`} className="text-sm cursor-pointer">
                        {shift.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Raison (optionnel)</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Ex: Maladie, Vacances, Formation..."
                rows={2}
                data-testid="absence-reason"
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Les quarts sélectionnés seront désassignés automatiquement et apparaîtront dans la section "Remplacements".
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="save-absence-btn">
                {editingAbsence ? 'Enregistrer' : 'Déclarer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
