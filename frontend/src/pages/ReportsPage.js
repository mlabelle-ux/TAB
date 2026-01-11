import { useState, useMemo } from 'react';
import { getHoursReportPDF } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { ScrollArea } from '../components/ui/scroll-area';
import { FileText, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsPage({ employees }) {
  const [dateMode, setDateMode] = useState('custom'); // 'first_half', 'second_half', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [sortBy, setSortBy] = useState('name'); // name, matricule, hire_date

  // Liste des employés triés alphabétiquement pour la sélection
  const sortedEmployeesForSelection = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Calculer les dates basées sur le mode
  const getReportDates = () => {
    if (dateMode === 'custom') {
      return { start: startDate, end: endDate };
    }
    
    const [year, month] = selectedMonth.split('-').map(Number);
    
    if (dateMode === 'first_half') {
      return {
        start: `${year}-${month.toString().padStart(2, '0')}-01`,
        end: `${year}-${month.toString().padStart(2, '0')}-15`
      };
    }
    
    // second_half
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${month.toString().padStart(2, '0')}-16`,
      end: `${year}-${month.toString().padStart(2, '0')}-${lastDay}`
    };
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEmployees([]);
    }
  };

  const handleEmployeeToggle = (empId) => {
    setSelectAll(false);
    setSelectedEmployees(prev => 
      prev.includes(empId)
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleGeneratePDF = () => {
    const { start, end } = getReportDates();
    
    if (!start || !end) {
      toast.error('Veuillez sélectionner les dates');
      return;
    }

    if (new Date(start) > new Date(end)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    const employeeIds = selectAll ? '' : selectedEmployees.join(',');
    const url = getHoursReportPDF(start, end, employeeIds, sortBy);
    
    window.open(url, '_blank');
    toast.success('Génération du rapport en cours...');
  };

  // Formater le mois pour l'affichage
  const formatMonthDisplay = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div data-testid="reports-page">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapport des heures travaillées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Mode Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Période du rapport</Label>
            <RadioGroup value={dateMode} onValueChange={setDateMode} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${dateMode === 'first_half' ? 'border-[#4CAF50] bg-[#4CAF50]/10' : 'border-input hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="first_half" id="first_half" />
                <Label htmlFor="first_half" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">1er au 15 du mois</div>
                  <div className="text-xs text-muted-foreground">Première quinzaine</div>
                </Label>
              </div>
              <div className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${dateMode === 'second_half' ? 'border-[#4CAF50] bg-[#4CAF50]/10' : 'border-input hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="second_half" id="second_half" />
                <Label htmlFor="second_half" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">16 au dernier jour</div>
                  <div className="text-xs text-muted-foreground">Deuxième quinzaine</div>
                </Label>
              </div>
              <div className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${dateMode === 'custom' ? 'border-[#4CAF50] bg-[#4CAF50]/10' : 'border-input hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">Dates personnalisées</div>
                  <div className="text-xs text-muted-foreground">Sélection libre</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Month Selection (for first_half and second_half modes) */}
          {(dateMode === 'first_half' || dateMode === 'second_half') && (
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="month">Mois</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full"
                data-testid="report-month"
              />
              <p className="text-sm text-muted-foreground">
                {dateMode === 'first_half' 
                  ? `Du 1er au 15 ${formatMonthDisplay(selectedMonth)}`
                  : `Du 16 au dernier jour de ${formatMonthDisplay(selectedMonth)}`
                }
              </p>
            </div>
          )}

          {/* Custom Date Selection */}
          {dateMode === 'custom' && (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="start-date">Date de début</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                    data-testid="report-start-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Date de fin</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10"
                    data-testid="report-end-date"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sort Option */}
          <div className="space-y-3">
            <Label>Ordre de tri du rapport généré</Label>
            <RadioGroup value={sortBy} onValueChange={setSortBy} className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="name" id="sort-name" />
                <Label htmlFor="sort-name" className="cursor-pointer font-normal">
                  Ordre alphabétique
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="matricule" id="sort-matricule" />
                <Label htmlFor="sort-matricule" className="cursor-pointer font-normal">
                  Par matricule
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hire_date" id="sort-hire" />
                <Label htmlFor="sort-hire" className="cursor-pointer font-normal">
                  Par date d'embauche
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Employee Selection */}
          <div className="space-y-3">
            <Label>Employés à inclure (triés alphabétiquement)</Label>
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
                data-testid="select-all-employees"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Tous les employés
              </label>
            </div>
            
            {!selectAll && (
              <Card className="p-4">
                <ScrollArea className="h-64">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {sortedEmployeesForSelection.map((emp) => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => handleEmployeeToggle(emp.id)}
                          data-testid={`select-employee-${emp.id}`}
                        />
                        <label 
                          htmlFor={`emp-${emp.id}`} 
                          className="text-sm cursor-pointer truncate"
                        >
                          {emp.matricule ? `[${emp.matricule}] ` : ''}{emp.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedEmployees.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedEmployees.length} employé(s) sélectionné(s)
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGeneratePDF}
            className="bg-[#4CAF50] hover:bg-[#43A047]"
            data-testid="generate-report-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Générer le rapport PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
