import { useState } from 'react';
import { createHoliday, deleteHoliday } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Plus, Trash2, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';

export default function HolidaysPage({ holidays, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [dateMode, setDateMode] = useState('single'); // 'single' or 'range'
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    start_date: '',
    end_date: ''
  });

  const sortedHolidays = [...holidays].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    
    if (dateMode === 'single' && !formData.date) {
      toast.error('La date est requise');
      return;
    }
    
    if (dateMode === 'range' && (!formData.start_date || !formData.end_date)) {
      toast.error('Les dates de début et fin sont requises');
      return;
    }

    try {
      if (dateMode === 'single') {
        // Créer un seul jour férié
        await createHoliday({ name: formData.name, date: formData.date });
        toast.success('Jour férié ajouté');
      } else {
        // Créer plusieurs jours fériés pour la période
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        
        if (start > end) {
          toast.error('La date de début doit être avant la date de fin');
          return;
        }
        
        let count = 0;
        let current = new Date(start);
        while (current <= end) {
          // Exclure les weekends
          if (current.getDay() !== 0 && current.getDay() !== 6) {
            await createHoliday({ 
              name: formData.name, 
              date: current.toISOString().split('T')[0] 
            });
            count++;
          }
          current.setDate(current.getDate() + 1);
        }
        toast.success(`${count} jour(s) férié(s) ajouté(s)`);
      }
      
      setShowModal(false);
      setFormData({ name: '', date: '', start_date: '', end_date: '' });
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleDelete = async (holiday) => {
    if (!window.confirm(`Supprimer "${holiday.name}"?`)) return;
    
    try {
      await deleteHoliday(holiday.id);
      toast.success('Jour férié supprimé');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div data-testid="holidays-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Jours fériés et exceptions
            <Badge variant="secondary">{holidays.length}</Badge>
          </CardTitle>
          <Button onClick={() => setShowModal(true)} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-holiday-btn">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHolidays.map((holiday) => (
                  <TableRow key={holiday.id} data-testid={`holiday-row-${holiday.id}`}>
                    <TableCell className="font-medium">
                      {formatDateDisplay(holiday.date)}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(holiday)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-holiday-${holiday.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedHolidays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Aucun jour férié configuré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un jour férié</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Fête du travail"
                data-testid="holiday-name-input"
              />
            </div>
            
            <div className="space-y-3">
              <Label>Type de sélection</Label>
              <RadioGroup value={dateMode} onValueChange={setDateMode} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="cursor-pointer font-normal">
                    Journée unique
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="range" id="range" />
                  <Label htmlFor="range" className="cursor-pointer font-normal">
                    Période (plusieurs jours)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {dateMode === 'single' ? (
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="holiday-date-input"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Date de début *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    data-testid="holiday-start-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Date de fin *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    data-testid="holiday-end-date-input"
                  />
                </div>
              </div>
            )}
            
            {dateMode === 'range' && (
              <p className="text-sm text-muted-foreground">
                Note: Les weekends seront automatiquement exclus de la période.
              </p>
            )}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="save-holiday-btn">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
