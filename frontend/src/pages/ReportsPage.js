import { useState } from 'react';
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
    if (!startDate || !endDate) {
      toast.error('Veuillez sélectionner les dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }

    const employeeIds = selectAll ? '' : selectedEmployees.join(',');
    const url = getHoursReportPDF(startDate, endDate, employeeIds, sortBy);
    
    window.open(url, '_blank');
    toast.success('Génération du rapport en cours...');
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
          {/* Date Selection */}
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

          {/* Sort Option */}
          <div className="space-y-3">
            <Label>Ordre de tri des conducteurs</Label>
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
            <Label>Employés à inclure</Label>
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
                    {employees.map((emp) => (
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
