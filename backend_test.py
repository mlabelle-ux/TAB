#!/usr/bin/env python3
"""
Comprehensive backend API testing for Bus Driver Schedule Management System
Tests all CRUD operations and authentication functionality
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

class BusScheduleAPITester:
    def __init__(self, base_url: str = "https://drivertimetable.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_employee_id = None
        self.created_school_id = None
        self.created_assignment_id = None
        self.created_absence_id = None
        self.created_holiday_id = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
            
            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_auth_login(self):
        """Test authentication with admin password 1600 (Fernand Alary)"""
        success, response = self.make_request('POST', 'auth/login', {"password": "1600"})
        
        if success and response.get('success') and response.get('admin'):
            self.admin_data = response['admin']
            self.log_test("Login avec mot de passe 1600 (Fernand Alary)", True)
            return True
        else:
            self.log_test("Login avec mot de passe 1600 (Fernand Alary)", False, 
                         f"Response: {response}")
            return False

    def test_init_data(self):
        """Test initialization of default admin data"""
        success, response = self.make_request('POST', 'init-data')
        self.log_test("Initialisation des données par défaut", success, 
                     f"Response: {response}" if not success else "")
        return success

    def test_get_admins(self):
        """Test getting list of admins"""
        success, response = self.make_request('GET', 'admins')
        
        if success and isinstance(response, list) and len(response) >= 5:
            # Check if all required admin codes exist
            admin_codes = [admin.get('code') for admin in response]
            required_codes = ['1600', '2201', '2202', '2203', '2204']
            has_all_codes = all(code in admin_codes for code in required_codes)
            
            self.log_test("Récupération des administrateurs", has_all_codes,
                         f"Codes trouvés: {admin_codes}" if not has_all_codes else "")
            return has_all_codes
        else:
            self.log_test("Récupération des administrateurs", False, f"Response: {response}")
            return False

    def test_employee_crud(self):
        """Test Employee CRUD operations"""
        # Create employee
        employee_data = {
            "name": "Jean Testeur",
            "hire_date": "2024-01-15",
            "phone": "514-555-1234",
            "email": "jean.testeur@test.com",
            "berline": "B001"
        }
        
        success, response = self.make_request('POST', 'employees', employee_data, 200)
        if success and response.get('id'):
            self.created_employee_id = response['id']
            self.log_test("Création d'employé", True)
        else:
            self.log_test("Création d'employé", False, f"Response: {response}")
            return False

        # Get employees
        success, response = self.make_request('GET', 'employees')
        if success and isinstance(response, list):
            self.log_test("Récupération des employés", True)
        else:
            self.log_test("Récupération des employés", False, f"Response: {response}")

        # Update employee
        update_data = {
            "name": "Jean Testeur Modifié",
            "hire_date": "2024-01-15",
            "phone": "514-555-5678",
            "email": "jean.modifie@test.com",
            "berline": "B002"
        }
        
        success, response = self.make_request('PUT', f'employees/{self.created_employee_id}', update_data)
        self.log_test("Modification d'employé", success, f"Response: {response}" if not success else "")

        return True

    def test_school_crud(self):
        """Test School CRUD operations"""
        # Create school
        school_data = {
            "name": "École Test Primaire",
            "color": "#FF5722"
        }
        
        success, response = self.make_request('POST', 'schools', school_data, 200)
        if success and response.get('id'):
            self.created_school_id = response['id']
            self.log_test("Création d'école", True)
        else:
            self.log_test("Création d'école", False, f"Response: {response}")
            return False

        # Get schools
        success, response = self.make_request('GET', 'schools')
        if success and isinstance(response, list):
            self.log_test("Récupération des écoles", True)
        else:
            self.log_test("Récupération des écoles", False, f"Response: {response}")

        # Update school
        update_data = {
            "name": "École Test Primaire Modifiée",
            "color": "#2196F3"
        }
        
        success, response = self.make_request('PUT', f'schools/{self.created_school_id}', update_data)
        self.log_test("Modification d'école", success, f"Response: {response}" if not success else "")

        return True

    def test_assignment_crud(self):
        """Test Assignment CRUD operations"""
        if not self.created_employee_id or not self.created_school_id:
            self.log_test("Création d'assignation", False, "Employee ou School manquant")
            return False

        # Create assignment with shifts and blocks
        assignment_data = {
            "circuit_number": "TEST-204",
            "employee_id": self.created_employee_id,
            "start_date": "2024-12-01",
            "end_date": "2024-12-31",
            "shifts": [
                {
                    "id": "shift-am-1",
                    "name": "AM",
                    "blocks": [
                        {
                            "id": "block-1",
                            "school_id": self.created_school_id,
                            "school_name": "École Test Primaire",
                            "school_color": "#FF5722",
                            "start_time": "07:30",
                            "end_time": "08:15",
                            "hlp_before": 10,
                            "hlp_after": 5
                        }
                    ]
                },
                {
                    "id": "shift-pm-1",
                    "name": "PM",
                    "blocks": [
                        {
                            "id": "block-2",
                            "school_id": self.created_school_id,
                            "school_name": "École Test Primaire",
                            "school_color": "#FF5722",
                            "start_time": "15:00",
                            "end_time": "15:45",
                            "hlp_before": 5,
                            "hlp_after": 10
                        }
                    ]
                }
            ]
        }
        
        success, response = self.make_request('POST', 'assignments', assignment_data, 200)
        if success and response.get('id'):
            self.created_assignment_id = response['id']
            self.log_test("Création d'assignation avec quarts AM/PM", True)
        else:
            self.log_test("Création d'assignation avec quarts AM/PM", False, f"Response: {response}")
            return False

        # Get assignments
        success, response = self.make_request('GET', 'assignments')
        if success and isinstance(response, list):
            self.log_test("Récupération des assignations", True)
        else:
            self.log_test("Récupération des assignations", False, f"Response: {response}")

        # Update assignment
        update_data = {
            "circuit_number": "TEST-204-MODIFIE",
            "employee_id": None  # Unassign employee
        }
        
        success, response = self.make_request('PUT', f'assignments/{self.created_assignment_id}', update_data)
        self.log_test("Modification d'assignation (désassignation)", success, 
                     f"Response: {response}" if not success else "")

        return True

    def test_absence_crud(self):
        """Test Absence CRUD operations"""
        if not self.created_employee_id:
            self.log_test("Création d'absence", False, "Employee manquant")
            return False

        # Create absence
        absence_data = {
            "employee_id": self.created_employee_id,
            "start_date": "2024-12-15",
            "end_date": "2024-12-20",
            "reason": "Vacances de test"
        }
        
        success, response = self.make_request('POST', 'absences', absence_data, 200)
        if success and response.get('id'):
            self.created_absence_id = response['id']
            self.log_test("Déclaration d'absence", True)
        else:
            self.log_test("Déclaration d'absence", False, f"Response: {response}")
            return False

        # Get absences
        success, response = self.make_request('GET', 'absences')
        if success and isinstance(response, list):
            self.log_test("Récupération des absences", True)
        else:
            self.log_test("Récupération des absences", False, f"Response: {response}")

        return True

    def test_holiday_crud(self):
        """Test Holiday CRUD operations"""
        # Create holiday
        holiday_data = {
            "name": "Jour de test",
            "date": "2024-12-25"
        }
        
        success, response = self.make_request('POST', 'holidays', holiday_data, 200)
        if success and response.get('id'):
            self.created_holiday_id = response['id']
            self.log_test("Ajout de jour férié", True)
        else:
            self.log_test("Ajout de jour férié", False, f"Response: {response}")
            return False

        # Get holidays
        success, response = self.make_request('GET', 'holidays')
        if success and isinstance(response, list):
            self.log_test("Récupération des jours fériés", True)
        else:
            self.log_test("Récupération des jours fériés", False, f"Response: {response}")

        return True

    def test_schedule_endpoint(self):
        """Test schedule generation endpoint"""
        # Test with week_start parameter
        success, response = self.make_request('GET', 'schedule?week_start=2024-12-02')
        
        if success and isinstance(response, dict):
            has_schedule = 'schedule' in response
            has_replacements = 'replacements' in response
            has_week_dates = 'week_dates' in response
            
            all_present = has_schedule and has_replacements and has_week_dates
            self.log_test("Génération d'horaire avec section Remplacements", all_present,
                         f"Manque: {[k for k in ['schedule', 'replacements', 'week_dates'] if k not in response]}" if not all_present else "")
        else:
            self.log_test("Génération d'horaire avec section Remplacements", False, f"Response: {response}")

    def test_temporary_tasks(self):
        """Test temporary tasks functionality"""
        if not self.created_employee_id or not self.created_school_id:
            self.log_test("Création de tâche temporaire", False, "Employee ou School manquant")
            return False

        # Create temporary task
        task_data = {
            "name": "Transport spécial test",
            "date": "2024-12-10",
            "start_time": "10:00",
            "end_time": "11:30",
            "employee_id": self.created_employee_id,
            "school_id": self.created_school_id
        }
        
        success, response = self.make_request('POST', 'temporary-tasks', task_data, 200)
        if success and response.get('id'):
            self.log_test("Création de tâche temporaire", True)
            
            # Get temporary tasks
            success, response = self.make_request('GET', 'temporary-tasks')
            self.log_test("Récupération des tâches temporaires", success and isinstance(response, list))
        else:
            self.log_test("Création de tâche temporaire", False, f"Response: {response}")

    def test_pdf_report(self):
        """Test PDF report generation"""
        success, response = self.make_request('GET', 
            'reports/hours-pdf?start_date=2024-12-01&end_date=2024-12-07', 
            expected_status=200)
        
        # For PDF, we expect a successful response but won't parse the binary content
        self.log_test("Génération de rapport PDF", success, 
                     f"Status code: {response.get('status_code', 'unknown')}" if not success else "")

    def cleanup_test_data(self):
        """Clean up created test data"""
        cleanup_results = []
        
        # Delete in reverse order of creation to handle dependencies
        if self.created_absence_id:
            success, _ = self.make_request('DELETE', f'absences/{self.created_absence_id}', expected_status=200)
            cleanup_results.append(f"Absence: {'✅' if success else '❌'}")

        if self.created_assignment_id:
            success, _ = self.make_request('DELETE', f'assignments/{self.created_assignment_id}', expected_status=200)
            cleanup_results.append(f"Assignment: {'✅' if success else '❌'}")

        if self.created_holiday_id:
            success, _ = self.make_request('DELETE', f'holidays/{self.created_holiday_id}', expected_status=200)
            cleanup_results.append(f"Holiday: {'✅' if success else '❌'}")

        if self.created_school_id:
            success, _ = self.make_request('DELETE', f'schools/{self.created_school_id}', expected_status=200)
            cleanup_results.append(f"School: {'✅' if success else '❌'}")

        if self.created_employee_id:
            success, _ = self.make_request('DELETE', f'employees/{self.created_employee_id}', expected_status=200)
            cleanup_results.append(f"Employee: {'✅' if success else '❌'}")

        print(f"\n🧹 Nettoyage des données de test: {', '.join(cleanup_results)}")

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚌 Test du système de gestion des horaires d'autobus scolaire")
        print("=" * 60)
        
        # Initialize data first
        self.test_init_data()
        
        # Authentication tests
        if not self.test_auth_login():
            print("❌ Échec de l'authentification - arrêt des tests")
            return False
        
        self.test_get_admins()
        
        # CRUD operations tests
        self.test_employee_crud()
        self.test_school_crud()
        self.test_assignment_crud()
        self.test_absence_crud()
        self.test_holiday_crud()
        
        # Advanced functionality tests
        self.test_schedule_endpoint()
        self.test_temporary_tasks()
        self.test_pdf_report()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Results summary
        print("\n" + "=" * 60)
        print(f"📊 Résultats: {self.tests_passed}/{self.tests_run} tests réussis")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Taux de réussite: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 Tous les tests backend sont réussis!")
            return True
        else:
            print("⚠️  Certains tests ont échoué - voir les détails ci-dessus")
            return False

def main():
    """Main test execution"""
    tester = BusScheduleAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())