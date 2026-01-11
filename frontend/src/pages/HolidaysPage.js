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
import { Plus, Trash2, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';

export default function HolidaysPage({ holidays, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: ''
  });

  const sortedHolidays = [...holidays].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      toast.error('Tous les champs sont requis');
      return;
    }

    try {
      await createHoliday(formData);
      toast.success('Jour férié ajouté');
      setShowModal(false);
      setFormData({ name: '', date: '' });
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
