import { useState, useMemo } from 'react';
import { createEmployee, updateEmployee, deleteEmployee } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Checkbox } from '../components/ui/checkbox';
import { Plus, Edit, Trash2, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, UserX } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeesPage({ employees, onUpdate }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState({
    matricule: '',
    name: '',
    hire_date: '',
    phone: '',
    email: '',
    berline: '',
    is_inactive: false
  });

  // Count active and inactive
  const activeCount = employees.filter(e => !e.is_inactive).length;
  const inactiveCount = employees.filter(e => e.is_inactive).length;

  // Filter and sort employees
  const filteredAndSortedEmployees = useMemo(() => {
    let result = employees.filter(emp => {
      // Filter by search
      const matchesSearch = 
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase()) ||
        emp.matricule?.toLowerCase().includes(search.toLowerCase()) ||
        emp.berline?.toLowerCase().includes(search.toLowerCase());
      
      // Filter by active/inactive
      if (!showInactive && emp.is_inactive) return false;
      
      return matchesSearch;
    });

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key] || '';
      let bVal = b[sortConfig.key] || '';
      
      if (sortConfig.key === 'hire_date') {
        aVal = aVal || '9999-99-99';
        bVal = bVal || '9999-99-99';
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [employees, search, sortConfig, showInactive]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      matricule: '',
      name: '',
      hire_date: new Date().toISOString().split('T')[0],
      phone: '',
      email: '',
      berline: '',
      is_inactive: false
    });
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      matricule: emp.matricule || '',
      name: emp.name,
      hire_date: emp.hire_date,
      phone: emp.phone || '',
      email: emp.email || '',
      berline: emp.berline || '',
      is_inactive: emp.is_inactive || false
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, formData);
        toast.success('Employé modifié');
      } else {
        await createEmployee(formData);
        toast.success('Employé ajouté');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erreur lors de l\'enregistrement';
      toast.error(message);
    }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Supprimer ${emp.name}?`)) return;
    
    try {
      await deleteEmployee(emp.id);
      toast.success('Employé supprimé');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div data-testid="employees-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Gestion des employés
            <Badge variant="secondary">{activeCount} actifs</Badge>
            {inactiveCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground">{inactiveCount} inactifs</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Afficher inactifs
              </Label>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="employee-search"
              />
            </div>
            <Button onClick={openAddModal} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-employee-btn">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[calc(100vh-280px)]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('matricule')}
                  >
                    <div className="flex items-center">
                      Matricule
                      <SortIcon columnKey="matricule" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Conducteur
                      <SortIcon columnKey="name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('hire_date')}
                  >
                    <div className="flex items-center">
                      Date d'embauche
                      <SortIcon columnKey="hire_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      Courriel
                      <SortIcon columnKey="email" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center">
                      Téléphone
                      <SortIcon columnKey="phone" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('berline')}
                  >
                    <div className="flex items-center">
                      Berline
                      <SortIcon columnKey="berline" />
                    </div>
                  </TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedEmployees.map((emp) => (
                  <TableRow key={emp.id} data-testid={`employee-row-${emp.id}`} className={emp.is_inactive ? 'opacity-50 bg-muted/30' : ''}>
                    <TableCell className="font-mono">{emp.matricule || '-'}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {emp.name}
                        {emp.is_inactive && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <UserX className="h-3 w-3 mr-1" />
                            Inactif
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{emp.hire_date}</TableCell>
                    <TableCell>{emp.email || '-'}</TableCell>
                    <TableCell>{emp.phone || '-'}</TableCell>
                    <TableCell>{emp.berline || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(emp)}
                          data-testid={`edit-employee-${emp.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(emp)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`delete-employee-${emp.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {search ? 'Aucun résultat' : 'Aucun employé'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Modifier l\'employé' : 'Ajouter un employé'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matricule">Matricule</Label>
                <Input
                  id="matricule"
                  value={formData.matricule}
                  onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                  placeholder="Ex: EMP001"
                  data-testid="employee-matricule-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="berline">Berline</Label>
                <Input
                  id="berline"
                  value={formData.berline}
                  onChange={(e) => setFormData({ ...formData, berline: e.target.value })}
                  placeholder="Numéro de berline"
                  data-testid="employee-berline-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nom complet"
                data-testid="employee-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire_date">Date d'embauche</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                data-testid="employee-hire-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="exemple@email.com"
                data-testid="employee-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="514-555-1234"
                data-testid="employee-phone-input"
              />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="is_inactive"
                checked={formData.is_inactive}
                onCheckedChange={(checked) => setFormData({ ...formData, is_inactive: checked })}
                data-testid="employee-inactive-checkbox"
              />
              <Label htmlFor="is_inactive" className="cursor-pointer flex items-center gap-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                <span>Employé inactif</span>
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="save-employee-btn">
                {editingEmployee ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
