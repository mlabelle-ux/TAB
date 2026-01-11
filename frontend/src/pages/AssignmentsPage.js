import { useState, useMemo } from 'react';
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
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Edit, Trash2, Search, Bus, X, Accessibility, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const generateTimeOptions = () => {
  const options = [];
  for (let h = 5; h <= 19; h++) {
    for (let m = 0; m < 60; m += 5) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      options.push(time);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();
const DAYS = [
  { id: 'L', label: 'Lun' },
  { id: 'M', label: 'Mar' },
  { id: 'W', label: 'Mer' },
  { id: 'J', label: 'Jeu' },
  { id: 'V', label: 'Ven' },
];

// Périodes prédéfinies par défaut
const DEFAULT_PREDEFINED_PERIODS = [
  { id: '1', label: 'Année scolaire 2024-2025', start: '2024-08-26', end: '2025-06-20' },
  { id: '2', label: 'Année scolaire 2025-2026', start: '2025-08-25', end: '2026-06-19' },
  { id: '3', label: '1er semestre 2024-2025', start: '2024-08-26', end: '2025-01-17' },
  { id: '4', label: '2e semestre 2024-2025', start: '2025-01-20', end: '2025-06-20' },
];

export default function AssignmentsPage({ assignments, employees, schools, onUpdate }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    circuit_number: '',
    employee_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    shifts: [],
    is_adapted: false
  });
  
  // Périodes prédéfinies (stockées dans localStorage)
  const [predefinedPeriods, setPredefinedPeriods] = useState(() => {
    const saved = localStorage.getItem('assignmentPeriods');
    return saved ? JSON.parse(saved) : DEFAULT_PREDEFINED_PERIODS;
  });
  const [newPeriod, setNewPeriod] = useState({ label: '', start: '', end: '' });

  // Trier les employés par ordre alphabétique
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Trier les assignations: circuits numériques d'abord, puis Admin/Mécano à la fin
  const sortedAssignments = useMemo(() => {
    const filtered = assignments.filter(a =>
      a.circuit_number.toLowerCase().includes(search.toLowerCase()) ||
      a.employee_name?.toLowerCase().includes(search.toLowerCase())
    );
    
    return filtered.sort((a, b) => {
      const aIsAdmin = a.shifts?.some(s => s.is_admin);
      const bIsAdmin = b.shifts?.some(s => s.is_admin);
      
      // Admin/Mécano toujours à la fin
      if (aIsAdmin && !bIsAdmin) return 1;
      if (!aIsAdmin && bIsAdmin) return -1;
      
      // Tri par numéro de circuit
      const aNum = parseInt(a.circuit_number) || Infinity;
      const bNum = parseInt(b.circuit_number) || Infinity;
      if (aNum !== bNum) return aNum - bNum;
      
      return a.circuit_number.localeCompare(b.circuit_number);
    });
  }, [assignments, search]);

  const openAddModal = () => {
    setEditingAssignment(null);
    setFormData({
      circuit_number: '',
      employee_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shifts: [],
      is_adapted: false
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
      shifts: assignment.shifts || [],
      is_adapted: assignment.is_adapted || false
    });
    setShowModal(true);
  };

  const addShift = (type) => {
    const isAdmin = type === 'ADMIN' || type === 'MECANO';
    const newShift = {
      id: uuidv4(),
      name: type,
      blocks: isAdmin ? [] : [],
      is_admin: isAdmin,
      admin_hours: 8 // Heures fixes par défaut pour admin/mécano (modifiable)
    };
    
    if (isAdmin) {
      newShift.blocks = [{
        id: uuidv4(),
        school_id: '',
        school_name: type === 'MECANO' ? 'Mécanique' : 'Administration',
        school_color: type === 'MECANO' ? '#795548' : '#607D8B',
        start_time: '06:00',
        end_time: '14:00',
        hlp_before: 0,
        hlp_after: 0,
        days: ['L', 'M', 'W', 'J', 'V']
      }];
    }
    
    setFormData({ ...formData, shifts: [...formData.shifts, newShift] });
  };

  const removeShift = (shiftId) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.filter(s => s.id !== shiftId)
    });
  };

  const updateShift = (shiftId, updates) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.map(s =>
        s.id === shiftId ? { ...s, ...updates } : s
      )
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
      hlp_after: 0,
      days: ['L', 'M', 'W', 'J', 'V']
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

  const toggleBlockDay = (shiftId, blockId, dayId) => {
    const shift = formData.shifts.find(s => s.id === shiftId);
    const block = shift?.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const currentDays = block.days || ['L', 'M', 'W', 'J', 'V'];
    const newDays = currentDays.includes(dayId)
      ? currentDays.filter(d => d !== dayId)
      : [...currentDays, dayId];
    
    updateBlock(shiftId, blockId, { days: newDays });
  };

  const calculateShiftDuration = (shift) => {
    if (shift.is_admin) return (shift.admin_hours || 8) * 60;
    
    let total = 0;
    for (const block of shift.blocks || []) {
      const start = timeToMinutes(block.start_time);
      const end = timeToMinutes(block.end_time);
      total += (end - start) + (block.hlp_before || 0) + (block.hlp_after || 0);
    }
    return total;
  };

  const handlePredefinedPeriod = (period) => {
    setFormData({
      ...formData,
      start_date: period.start,
      end_date: period.end
    });
  };

  // Gestion des périodes prédéfinies
  const savePeriods = (periods) => {
    setPredefinedPeriods(periods);
    localStorage.setItem('assignmentPeriods', JSON.stringify(periods));
  };

  const addPredefinedPeriod = () => {
    if (!newPeriod.label || !newPeriod.start || !newPeriod.end) {
      toast.error('Tous les champs sont requis');
      return;
    }
    const period = { ...newPeriod, id: uuidv4() };
    savePeriods([...predefinedPeriods, period]);
    setNewPeriod({ label: '', start: '', end: '' });
    toast.success('Période ajoutée');
  };

  const deletePredefinedPeriod = (id) => {
    savePeriods(predefinedPeriods.filter(p => p.id !== id));
    toast.success('Période supprimée');
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
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowPeriodsModal(true)}
              data-testid="manage-periods-btn"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Périodes
            </Button>
            <Button onClick={openAddModal} className="bg-[#4CAF50] hover:bg-[#43A047]">
              <Plus className="h-4 w-4 mr-1" />
              Créer assignation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAssignments.map((assignment) => (
                <Card key={assignment.id} className="overflow-hidden">
                  <CardHeader className="pb-2 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-lg font-bold">
                          {assignment.circuit_number}
                        </Badge>
                        {assignment.is_adapted && (
                          <Accessibility className="h-5 w-5 text-blue-600" title="Circuit adapté" />
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(assignment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(assignment)}>
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
                        <span className="text-xs">{assignment.start_date} → {assignment.end_date}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-muted-foreground">Quarts:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignment.shifts?.map(shift => (
                            <Badge 
                              key={shift.id} 
                              variant={shift.is_admin ? 'default' : 'secondary'} 
                              className={shift.is_admin ? (shift.name === 'MECANO' ? 'bg-amber-700' : 'bg-blue-600') : ''}
                            >
                              {shift.name} ({shift.is_admin ? `${shift.admin_hours || 8}:00` : formatHoursMinutes(calculateShiftDuration(shift))})
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
              {sortedAssignments.length === 0 && (
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Modifier l\'assignation' : 'Créer une assignation'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numéro de circuit *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.circuit_number}
                    onChange={(e) => setFormData({ ...formData, circuit_number: e.target.value })}
                    placeholder="Entrer le numéro"
                    className="flex-1"
                  />
                  <Checkbox
                    id="is_adapted"
                    checked={formData.is_adapted}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_adapted: checked })}
                  />
                  <Label htmlFor="is_adapted" className="cursor-pointer flex items-center gap-1 text-sm whitespace-nowrap">
                    <Accessibility className="h-4 w-4 text-blue-600" />
                    Adapté
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conducteur</Label>
                <Select
                  value={formData.employee_id || "unassigned"}
                  onValueChange={(v) => setFormData({ ...formData, employee_id: v === "unassigned" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {sortedEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Périodes prédéfinies */}
            <div className="space-y-2">
              <Label>Période d'assignation</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {predefinedPeriods.map((period) => (
                  <Button
                    key={period.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePredefinedPeriod(period)}
                    className="text-xs"
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Date de début</Label>
                  <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Date de fin</Label>
                  <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Shifts Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Quarts de travail</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('AM')}>+ AM</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('MIDI')}>+ MIDI</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift('PM')}>+ PM</Button>
                  <Button type="button" variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => addShift('ADMIN')}>+ Admin</Button>
                  <Button type="button" variant="default" size="sm" className="bg-amber-700 hover:bg-amber-800" onClick={() => addShift('MECANO')}>+ Mécano</Button>
                </div>
              </div>

              {formData.shifts.map(shift => (
                <Card key={shift.id} className={`p-3 ${shift.is_admin ? (shift.name === 'MECANO' ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20') : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={shift.is_admin ? (shift.name === 'MECANO' ? 'bg-amber-700' : 'bg-blue-600') : ''}>{shift.name}</Badge>
                      {shift.is_admin && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Heures/jour:</span>
                          <Input
                            type="number"
                            value={shift.admin_hours || 8}
                            onChange={(e) => updateShift(shift.id, { admin_hours: parseFloat(e.target.value) || 8 })}
                            className="w-16 h-7 text-xs"
                            min="1"
                            max="12"
                            step="0.5"
                          />
                          <span className="text-xs text-muted-foreground">(Non impacté par fériés/congés)</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {shift.is_admin ? `${shift.admin_hours || 8}:00` : formatHoursMinutes(calculateShiftDuration(shift))}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeShift(shift.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Blocks - not for admin/mecano shifts */}
                  {!shift.is_admin && (
                    <div className="space-y-2">
                      {shift.blocks.map(block => (
                        <div key={block.id} className="p-2 bg-muted/50 rounded space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select value={block.school_id || "none"} onValueChange={(v) => handleSchoolSelect(shift.id, block.id, v === "none" ? "" : v)}>
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="École" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">École...</SelectItem>
                                {schools.map(school => (
                                  <SelectItem key={school.id} value={school.id}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: school.color }} />
                                      {school.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">HLP</span>
                              <Input
                                type="number"
                                value={block.hlp_before}
                                onChange={(e) => updateBlock(shift.id, block.id, { hlp_before: parseInt(e.target.value) || 0 })}
                                className="w-14 h-8 text-xs"
                                min="0"
                                step="5"
                              />
                            </div>

                            <Select value={block.start_time} onValueChange={(v) => updateBlock(shift.id, block.id, { start_time: v })}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <span className="text-muted-foreground">→</span>

                            <Select value={block.end_time} onValueChange={(v) => updateBlock(shift.id, block.id, { end_time: v })}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">HLP</span>
                              <Input
                                type="number"
                                value={block.hlp_after}
                                onChange={(e) => updateBlock(shift.id, block.id, { hlp_after: parseInt(e.target.value) || 0 })}
                                className="w-14 h-8 text-xs"
                                min="0"
                                step="5"
                              />
                            </div>

                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBlock(shift.id, block.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-1">Jours:</span>
                            {DAYS.map(day => (
                              <button
                                key={day.id}
                                type="button"
                                className={`w-8 h-6 text-xs font-medium rounded border transition-colors ${
                                  (block.days || ['L', 'M', 'W', 'J', 'V']).includes(day.id)
                                    ? 'bg-[#4CAF50] text-white border-[#4CAF50]'
                                    : 'bg-background border-input hover:bg-muted'
                                }`}
                                onClick={() => toggleBlockDay(shift.id, block.id, day.id)}
                              >
                                {day.label[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addBlock(shift.id)} className="w-full">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter un bloc
                      </Button>
                    </div>
                  )}
                </Card>
              ))}

              {formData.shifts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Ajoutez des quarts de travail
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]">
                {editingAssignment ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Periods Management Modal */}
      <Dialog open={showPeriodsModal} onOpenChange={setShowPeriodsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gérer les périodes d'assignation</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add new period */}
            <div className="space-y-3 p-3 border rounded-lg">
              <Label className="font-medium">Ajouter une période</Label>
              <Input
                placeholder="Nom de la période (ex: Année scolaire 2026-2027)"
                value={newPeriod.label}
                onChange={(e) => setNewPeriod({ ...newPeriod, label: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date de début</Label>
                  <Input
                    type="date"
                    value={newPeriod.start}
                    onChange={(e) => setNewPeriod({ ...newPeriod, start: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Date de fin</Label>
                  <Input
                    type="date"
                    value={newPeriod.end}
                    onChange={(e) => setNewPeriod({ ...newPeriod, end: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={addPredefinedPeriod} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {/* Existing periods */}
            <div className="space-y-2">
              <Label className="font-medium">Périodes existantes</Label>
              <ScrollArea className="h-48">
                {predefinedPeriods.map((period) => (
                  <div key={period.id} className="flex items-center justify-between p-2 bg-muted/50 rounded mb-2">
                    <div>
                      <div className="font-medium text-sm">{period.label}</div>
                      <div className="text-xs text-muted-foreground">{period.start} → {period.end}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePredefinedPeriod(period.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodsModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
