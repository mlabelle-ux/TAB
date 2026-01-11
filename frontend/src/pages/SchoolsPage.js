import { useState } from 'react';
import { createSchool, updateSchool, deleteSchool } from '../lib/api';
import { getContrastColor, schoolColorPalette } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Edit, Trash2, Search, School } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolsPage({ schools, onUpdate }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#4CAF50'
  });

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingSchool(null);
    setFormData({
      name: '',
      color: schoolColorPalette[schools.length % schoolColorPalette.length]
    });
    setShowModal(true);
  };

  const openEditModal = (school) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      color: school.color || '#4CAF50'
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
      if (editingSchool) {
        await updateSchool(editingSchool.id, formData);
        toast.success('École modifiée');
      } else {
        await createSchool(formData);
        toast.success('École ajoutée');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (school) => {
    if (!window.confirm(`Supprimer ${school.name}?`)) return;
    
    try {
      await deleteSchool(school.id);
      toast.success('École supprimée');
      onUpdate();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div data-testid="schools-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            Gestion des écoles
            <Badge variant="secondary">{schools.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="school-search"
              />
            </div>
            <Button onClick={openAddModal} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-school-btn">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredSchools.map((school) => (
                <Card 
                  key={school.id} 
                  className="overflow-hidden"
                  data-testid={`school-card-${school.id}`}
                >
                  <div 
                    className="h-3"
                    style={{ backgroundColor: school.color }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ 
                            backgroundColor: school.color,
                            color: getContrastColor(school.color)
                          }}
                        >
                          {school.name.charAt(0)}
                        </div>
                        <span className="font-medium">{school.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditModal(school)}
                          data-testid={`edit-school-${school.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(school)}
                          data-testid={`delete-school-${school.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredSchools.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  {search ? 'Aucun résultat' : 'Aucune école'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchool ? 'Modifier l\'école' : 'Ajouter une école'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'école *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nom de l'école"
                data-testid="school-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                  data-testid="school-color-input"
                />
                <div 
                  className="flex-1 h-10 rounded-md flex items-center justify-center font-medium"
                  style={{ 
                    backgroundColor: formData.color,
                    color: getContrastColor(formData.color)
                  }}
                >
                  Aperçu
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {schoolColorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="save-school-btn">
                {editingSchool ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
