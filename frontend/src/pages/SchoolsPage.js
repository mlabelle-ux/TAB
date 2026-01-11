import { useState, useMemo } from 'react';
import { createSchool, updateSchool, deleteSchool } from '../lib/api';
import { getContrastColor, schoolColorPalette } from '../lib/utils';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Plus, Edit, Trash2, Search, School, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

// Catégories par défaut
const DEFAULT_CATEGORIES = {
  type: ['Primaire', 'Secondaire', 'Autre'],
  commission: ['CSSRDN', 'CS Samares', 'CSSMI', 'CS Laval', 'CS Longueuil', 'CSDM'],
  ville: ['Montréal', 'Laval', 'Prévost', 'Sainte-Sophie', 'Lachute', 'St-Jérôme', 'St-Janvier', 'St-Colomban', 'St-Hippolyte']
};

export default function SchoolsPage({ schools, onUpdate }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterValue, setFilterValue] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    color: '#4CAF50',
    type: '',
    commission: '',
    ville: ''
  });
  
  // Charger les catégories depuis localStorage ou utiliser les valeurs par défaut
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('schoolCategories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [editingCategoryType, setEditingCategoryType] = useState('type');

  // Filtrer les écoles
  const filteredSchools = useMemo(() => {
    let result = schools.filter(school =>
      school.name.toLowerCase().includes(search.toLowerCase())
    );
    
    if (filterCategory !== 'all' && filterValue !== 'all') {
      result = result.filter(school => school[filterCategory] === filterValue);
    }
    
    return result;
  }, [schools, search, filterCategory, filterValue]);

  const openAddModal = () => {
    setEditingSchool(null);
    setFormData({
      name: '',
      color: schoolColorPalette[schools.length % schoolColorPalette.length],
      type: '',
      commission: '',
      ville: ''
    });
    setShowModal(true);
  };

  const openEditModal = (school) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      color: school.color || '#4CAF50',
      type: school.type || '',
      commission: school.commission || '',
      ville: school.ville || ''
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

  const saveCategories = (newCategories) => {
    setCategories(newCategories);
    localStorage.setItem('schoolCategories', JSON.stringify(newCategories));
  };

  const addCategoryValue = () => {
    if (!newCategoryValue.trim()) return;
    
    const newCategories = {
      ...categories,
      [editingCategoryType]: [...categories[editingCategoryType], newCategoryValue.trim()]
    };
    saveCategories(newCategories);
    setNewCategoryValue('');
    toast.success('Catégorie ajoutée');
  };

  const removeCategoryValue = (categoryType, value) => {
    const newCategories = {
      ...categories,
      [categoryType]: categories[categoryType].filter(v => v !== value)
    };
    saveCategories(newCategories);
    toast.success('Catégorie supprimée');
  };

  const handleFilterChange = (category, value) => {
    setFilterCategory(category);
    setFilterValue(value);
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
            <Button 
              variant="outline" 
              onClick={() => setShowCategoriesModal(true)}
              data-testid="manage-categories-btn"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Catégories
            </Button>
            <Button onClick={openAddModal} className="bg-[#4CAF50] hover:bg-[#43A047]" data-testid="add-school-btn">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtres par catégorie */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge 
              variant={filterCategory === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleFilterChange('all', 'all')}
            >
              Toutes
            </Badge>
            
            {/* Filtre par Type */}
            <Select 
              value={filterCategory === 'type' ? filterValue : ''} 
              onValueChange={(v) => handleFilterChange('type', v)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {categories.type.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Filtre par Commission */}
            <Select 
              value={filterCategory === 'commission' ? filterValue : ''} 
              onValueChange={(v) => handleFilterChange('commission', v)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue placeholder="Commission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes CS</SelectItem>
                {categories.commission.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Filtre par Ville */}
            <Select 
              value={filterCategory === 'ville' ? filterValue : ''} 
              onValueChange={(v) => handleFilterChange('ville', v)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes villes</SelectItem>
                {categories.ville.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <ScrollArea className="h-[calc(100vh-340px)]">
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div 
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                          style={{ 
                            backgroundColor: school.color,
                            color: getContrastColor(school.color)
                          }}
                        >
                          {school.name.charAt(0)}
                        </div>
                        <span className="font-medium truncate">{school.name}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
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
                    {/* Afficher les catégories */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {school.type && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{school.type}</Badge>
                      )}
                      {school.commission && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{school.commission}</Badge>
                      )}
                      {school.ville && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{school.ville}</Badge>
                      )}
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
            
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={formData.type || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, type: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {categories.type.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Commission scolaire</Label>
                <Select 
                  value={formData.commission || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, commission: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="CS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.commission.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Select 
                  value={formData.ville || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, ville: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ville" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.ville.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Categories Management Modal */}
      <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gérer les catégories</DialogTitle>
          </DialogHeader>
          
          <Tabs value={editingCategoryType} onValueChange={setEditingCategoryType}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="commission">Commission</TabsTrigger>
              <TabsTrigger value="ville">Ville</TabsTrigger>
            </TabsList>
            
            {['type', 'commission', 'ville'].map((catType) => (
              <TabsContent key={catType} value={catType} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={editingCategoryType === catType ? newCategoryValue : ''}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    placeholder={`Nouvelle ${catType === 'type' ? 'type' : catType === 'commission' ? 'commission' : 'ville'}`}
                    onKeyDown={(e) => e.key === 'Enter' && addCategoryValue()}
                  />
                  <Button onClick={addCategoryValue} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories[catType].map((value) => (
                    <Badge key={value} variant="secondary" className="flex items-center gap-1">
                      {value}
                      <button
                        type="button"
                        onClick={() => removeCategoryValue(catType, value)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoriesModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
