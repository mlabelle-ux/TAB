import { useState } from 'react';
import { createAssignment, updateAssignment, deleteAssignment } from '../lib/api';
import { getContrastColor, formatHoursMinutes, timeToMinutes } from '../lib/utils';
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
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Edit, Trash2, Search, Bus, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate time options in 5-minute increments
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

export default function AssignmentsPage({ assignments, employees, schools, onUpdate }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    circuit_number: '',
    employee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shifts: []
  });

  const filteredAssignments = assignments.filter(a =>
    a.circuit_number.toLowerCase().includes(search.toLowerCase()) ||
    a.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingAssignment(null);
    setFormData({
      circuit_number: '',
      employee_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shifts: []
    });
    setShowModal(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      circuit_number: assignment.circuit_number,
      employee_id: assignment.employee_id || '',
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      shifts: assignment.shifts || []
    });
    setShowModal(true);
  };

  const addShift = (type) => {
    const newShift = {
      id: uuidv4(),
      name: type,
      blocks: []
    };
    setFormData({ ...formData, shifts: [...formData.shifts, newShift] });
  };

  const removeShift = (shiftId) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.filter(s => s.id !== shiftId)
    });
  };

  const addBlock = (shiftId) => {
    const newBlock = {
      id: uuidv4(),
      school_id: '',
      school_name: '',
      school_color: '#9E9E9E',
      start_time: '07:00',
      end_time: '08:00',
      hlp_before: 0,
      hlp_after: 0
    };
    setFormData({
      ...formData,
      shifts: formData.shifts.map(s => 
        s.id === shiftId 
          ? { ...s, blocks: [...s.blocks, newBlock] }
          : s
      )
    });
  };

  const updateBlock = (shiftId, blockId, updates) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.map(s => 
        s.id === shiftId 
          ? { 
              ...s, 
              blocks: s.blocks.map(b => 
                b.id === blockId ? { ...b, ...updates } : b
              )
            }
          : s
      )
    });
  };

  const removeBlock = (shiftId, blockId) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.map(s => 
        s.id === shiftId 
          ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) }
          : s
      )
    });
  };

  const handleSchoolSelect = (shiftId, blockId, schoolId) => {
    const school = schools.find(s => s.id === schoolId);
    updateBlock(shiftId, blockId, {
      school_id: schoolId,
      school_name: school?.name || '',
      school_color: school?.color || '#9E9E9E'
    });
  };

  const calculateShiftDuration = (shift) => {
    let total = 0;
    for (const block of shift.blocks || []) {
      const start = timeToMinutes(block.start_time);
      const end = timeToMinutes(block.end_time);
      total += (end - start) + (block.hlp_before || 0) + (block.hlp_after || 0);
    }
    return total;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.circuit_number.trim()) {
      toast.error('Le numéro de circuit est requis');
      return;
    }

    try {
      if (editingAssignment) {
        await updateAssignment(editingAssignment.id, formData);
        toast.success('Assignation modifiée');
      } else {
        await createAssignment(formData);
        toast.success('Assignation créée');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (assignment) => {
    if (!window.confirm(`Supprimer le circuit ${assignment.circuit_number}?`)) return;
    
    try {
      await deleteAssignment(assignment.id);
      toast.success('Assignation supprimée');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div data-testid="assignments-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5" />
            Gestion des assignations
            <Badge variant="secondary">{assignments.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="assignment-search"
              />
            </div>
            <Button onClick={openAddModal} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-assignment-btn">
              <Plus className="h-4 w-4 mr-1" />
              Créer assignation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssignments.map((assignment) => (
                <Card key={assignment.id} className="overflow-hidden" data-testid={`assignment-card-${assignment.id}`}>
                  <CardHeader className="pb-2 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-lg font-bold">
                          {assignment.circuit_number}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditModal(assignment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conducteur:</span>
                        <span className="font-medium">{assignment.employee_name || 'Non assigné'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Période:</span>
                        <span>{assignment.start_date} - {assignment.end_date}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-muted-foreground">Quarts:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignment.shifts?.map(shift => (
                            <Badge key={shift.id} variant="secondary">
                              {shift.name} ({formatHoursMinutes(calculateShiftDuration(shift))})
                            </Badge>
                          ))}
                          {(!assignment.shifts || assignment.shifts.length === 0) && (
                            <span className="text-muted-foreground text-xs">Aucun quart</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredAssignments.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  {search ? 'Aucun résultat' : 'Aucune assignation'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Modifier l\'assignation' : 'Créer une assignation'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numéro de circuit *</Label>
                <Input
                  value={formData.circuit_number}
                  onChange={(e) => setFormData({ ...formData, circuit_number: e.target.value })}
                  placeholder="Ex: 204"
                  data-testid="circuit-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Conducteur</Label>
                <Select
                  value={formData.employee_id || "unassigned"}
                  onValueChange={(v) => setFormData({ ...formData, employee_id: v === "unassigned" ? "" : v })}
                >
                  <SelectTrigger data-testid="employee-select">
                    <SelectValue placeholder="Sélectionner un conducteur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Shifts Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Quarts de travail</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('AM')}>
                    + AM
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('MIDI')}>
                    + MIDI
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('PM')}>
                    + PM
                  </Button>
                </div>
              </div>

              {formData.shifts.map(shift => (
                <Card key={shift.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>{shift.name}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatHoursMinutes(calculateShiftDuration(shift))}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeShift(shift.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Blocks */}
                  <div className="space-y-2">
                    {shift.blocks.map(block => (
                      <div key={block.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Select
                          value={block.school_id}
                          onValueChange={(v) => handleSchoolSelect(shift.id, block.id, v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="École" />
                          </SelectTrigger>
                          <SelectContent>
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

                        <Select
                          value={block.start_time}
                          onValueChange={(v) => updateBlock(shift.id, block.id, { start_time: v })}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-muted-foreground">-</span>

                        <Select
                          value={block.end_time}
                          onValueChange={(v) => updateBlock(shift.id, block.id, { end_time: v })}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          value={block.hlp_before}
                          onChange={(e) => updateBlock(shift.id, block.id, { hlp_before: parseInt(e.target.value) || 0 })}
                          className="w-16"
                          placeholder="HLP av"
                          min="0"
                          step="5"
                        />
                        <Input
                          type="number"
                          value={block.hlp_after}
                          onChange={(e) => updateBlock(shift.id, block.id, { hlp_after: parseInt(e.target.value) || 0 })}
                          className="w-16"
                          placeholder="HLP ap"
                          min="0"
                          step="5"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeBlock(shift.id, block.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock(shift.id)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter un bloc
                    </Button>
                  </div>
                </Card>
              ))}

              {formData.shifts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Ajoutez des quarts de travail (AM, MIDI, PM)
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]">
                {editingAssignment ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
