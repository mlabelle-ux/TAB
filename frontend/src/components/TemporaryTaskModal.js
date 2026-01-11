import { useState, useMemo } from 'react';
import { createTemporaryTask, checkConflict } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Alert, AlertDescription, AlertTitle
} from '../components/ui/alert';
import { Label } from '../components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Generate time options in 5-minute increments (5h-18h59)
const generateTimeOptions = () => {
  const options = [];
  for (let h = 5; h <= 18; h++) {
    for (let m = 0; m < 60; m += 5) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      options.push(time);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export default function TemporaryTaskModal({ 
  open, 
  onClose, 
  onSuccess, 
  employees, 
  schools,
  selectedDate 
}) {
  const [formData, setFormData] = useState({
    name: '',
    date: selectedDate || new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '09:00',
    employee_id: '',
    school_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  // Trier les conducteurs par ordre alphabétique
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const checkForConflicts = async () => {
    if (!formData.employee_id) {
      return { conflict: false, conflicts: [] };
    }

    try {
      const response = await checkConflict({
        employee_id: formData.employee_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time
      });
      return response.data;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return { conflict: false, conflicts: [] };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    // Vérifier les conflits d'horaire
    const conflictResult = await checkForConflicts();
    
    if (conflictResult.conflict && !showConflictWarning) {
      setConflicts(conflictResult.conflicts);
      setShowConflictWarning(true);
      return;
    }

    setLoading(true);
    try {
      await createTemporaryTask(formData);
      onSuccess();
      // Reset form
      setFormData({
        name: '',
        date: selectedDate || new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '09:00',
        employee_id: '',
        school_id: ''
      });
      setConflicts([]);
      setShowConflictWarning(false);
    } catch (error) {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConflicts([]);
    setShowConflictWarning(false);
    onClose();
  };

  const handleEmployeeChange = (v) => {
    setFormData({ ...formData, employee_id: v === "none" ? "" : v });
    setShowConflictWarning(false);
    setConflicts([]);
  };

  const handleTimeChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setShowConflictWarning(false);
    setConflicts([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une tâche temporaire</DialogTitle>
          <DialogDescription>
            Créez une tâche ponctuelle pour un conducteur
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Nom de la tâche *</Label>
            <Input
              id="task-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Stage, Formation, Remplacement"
              data-testid="temp-task-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-date">Date</Label>
            <Input
              id="task-date"
              type="date"
              value={formData.date}
              onChange={(e) => {
                setFormData({ ...formData, date: e.target.value });
                setShowConflictWarning(false);
              }}
              data-testid="temp-task-date-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Select
                value={formData.start_time}
                onValueChange={(v) => handleTimeChange('start_time', v)}
              >
                <SelectTrigger data-testid="temp-task-start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Heure de fin</Label>
              <Select
                value={formData.end_time}
                onValueChange={(v) => handleTimeChange('end_time', v)}
              >
                <SelectTrigger data-testid="temp-task-end-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conducteur (trié alphabétiquement)</Label>
            <Select
              value={formData.employee_id || "none"}
              onValueChange={handleEmployeeChange}
            >
              <SelectTrigger data-testid="temp-task-employee">
                <SelectValue placeholder="Sélectionner un conducteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {sortedEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>École (optionnel)</Label>
            <Select
              value={formData.school_id || "none"}
              onValueChange={(v) => setFormData({ ...formData, school_id: v === "none" ? "" : v })}
            >
              <SelectTrigger data-testid="temp-task-school">
                <SelectValue placeholder="Sélectionner une école" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {schools.map(school => (
                  <SelectItem key={school.id} value={school.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: school.color }}
                      />
                      {school.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conflict Warning */}
          {showConflictWarning && conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Conflit d'horaire détecté!</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Cette tâche chevauche les éléments suivants :</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {conflicts.map((c, idx) => (
                    <li key={idx}>
                      {c.type === 'assignment' 
                        ? `Circuit ${c.circuit} - ${c.shift} (${c.block_time})` 
                        : `Tâche "${c.task_name}" (${c.task_time})`
                      }
                      <span className="text-xs ml-1">({c.overlap_minutes} min de chevauchement)</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-medium">
                  Les heures en double ne seront pas comptées. Voulez-vous continuer?
                </p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className={showConflictWarning ? "bg-amber-600 hover:bg-amber-700" : "bg-[#4CAF50] hover:bg-[#43A047]"}
              disabled={loading}
              data-testid="save-temp-task-btn"
            >
              {loading ? 'Création...' : showConflictWarning ? 'Créer malgré le conflit' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
