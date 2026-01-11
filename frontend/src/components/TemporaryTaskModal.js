import { useState } from 'react';
import { createTemporaryTask } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

// Generate time options in 5-minute increments
const generateTimeOptions = () => {
  const options = [];
  for (let h = 5; h <= 20; h++) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setLoading(true);
    try {
      await createTemporaryTask(formData);
      onSuccess();
    } catch (error) {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une tâche temporaire</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Nom de la tâche *</Label>
            <Input
              id="task-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Stage, Formation"
              data-testid="temp-task-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-date">Date</Label>
            <Input
              id="task-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              data-testid="temp-task-date-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heure de début</Label>
              <Select
                value={formData.start_time}
                onValueChange={(v) => setFormData({ ...formData, start_time: v })}
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
                onValueChange={(v) => setFormData({ ...formData, end_time: v })}
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
            <Label>Conducteur (optionnel)</Label>
            <Select
              value={formData.employee_id}
              onValueChange={(v) => setFormData({ ...formData, employee_id: v })}
            >
              <SelectTrigger data-testid="temp-task-employee">
                <SelectValue placeholder="Sélectionner un conducteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Non assigné</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>École (optionnel)</Label>
            <Select
              value={formData.school_id}
              onValueChange={(v) => setFormData({ ...formData, school_id: v })}
            >
              <SelectTrigger data-testid="temp-task-school">
                <SelectValue placeholder="Sélectionner une école" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune</SelectItem>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="bg-[#4CAF50] hover:bg-[#43A047]"
              disabled={loading}
              data-testid="save-temp-task-btn"
            >
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
