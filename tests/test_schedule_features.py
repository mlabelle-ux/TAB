"""
Test suite for Bus Driver Schedule Management System
Testing P0/P1/P2 features:
- P0: Replacements section, Drag & Drop temporary reassignments, View modes
- P1: Calendar date selection, Assignment form (Adapté checkbox)
- P2: Navigation icons, Circuit display for absent drivers
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendHealth:
    """Basic health checks"""
    
    def test_api_root(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_auth_login(self):
        """Test login with password 1600"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "1600"})
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "admin" in data
        assert data["admin"]["name"] == "Fernand Alary"


class TestTemporaryReassignments:
    """P0 - Test temporary reassignments API for Drag & Drop functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.today = datetime.now().strftime('%Y-%m-%d')
        # Get existing employees and assignments
        emp_response = requests.get(f"{BASE_URL}/api/employees")
        self.employees = emp_response.json() if emp_response.status_code == 200 else []
        
        ass_response = requests.get(f"{BASE_URL}/api/assignments")
        self.assignments = ass_response.json() if ass_response.status_code == 200 else []
    
    def test_get_temporary_reassignments(self):
        """Test GET /api/temporary-reassignments"""
        response = requests.get(f"{BASE_URL}/api/temporary-reassignments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_temporary_reassignments_by_date(self):
        """Test GET /api/temporary-reassignments with date filter"""
        response = requests.get(f"{BASE_URL}/api/temporary-reassignments?date={self.today}")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_temporary_reassignment(self):
        """Test POST /api/temporary-reassignments - Create temporary reassignment"""
        # Skip if no assignments exist
        if not self.assignments or not self.employees:
            pytest.skip("No assignments or employees to test with")
        
        assignment = self.assignments[0]
        shift_id = assignment.get('shifts', [{}])[0].get('id', 'test-shift') if assignment.get('shifts') else 'test-shift'
        
        payload = {
            "date": self.today,
            "assignment_id": assignment['id'],
            "shift_id": shift_id,
            "block_id": None,
            "original_employee_id": assignment.get('employee_id'),
            "new_employee_id": self.employees[0]['id'] if self.employees else None
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["date"] == self.today
        assert data["assignment_id"] == assignment['id']
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/temporary-reassignments/{data['id']}")
    
    def test_create_reassignment_to_replacement_zone(self):
        """Test creating reassignment with new_employee_id=null (unassign to replacement zone)"""
        if not self.assignments:
            pytest.skip("No assignments to test with")
        
        assignment = self.assignments[0]
        shift_id = assignment.get('shifts', [{}])[0].get('id', 'test-shift') if assignment.get('shifts') else 'test-shift'
        
        payload = {
            "date": self.today,
            "assignment_id": assignment['id'],
            "shift_id": shift_id,
            "block_id": None,
            "original_employee_id": assignment.get('employee_id'),
            "new_employee_id": None  # null = unassigned (in replacements)
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["new_employee_id"] is None
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/temporary-reassignments/{data['id']}")
    
    def test_delete_temporary_reassignment(self):
        """Test DELETE /api/temporary-reassignments/{id}"""
        if not self.assignments:
            pytest.skip("No assignments to test with")
        
        assignment = self.assignments[0]
        shift_id = assignment.get('shifts', [{}])[0].get('id', 'test-shift') if assignment.get('shifts') else 'test-shift'
        
        # Create first
        payload = {
            "date": self.today,
            "assignment_id": assignment['id'],
            "shift_id": shift_id,
            "block_id": None,
            "original_employee_id": assignment.get('employee_id'),
            "new_employee_id": None
        }
        create_response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=payload)
        assert create_response.status_code == 200
        reassignment_id = create_response.json()['id']
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/temporary-reassignments/{reassignment_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/temporary-reassignments")
        reassignments = get_response.json()
        assert not any(r['id'] == reassignment_id for r in reassignments)
    
    def test_delete_reassignments_by_date(self):
        """Test DELETE /api/temporary-reassignments/by-date/{date}"""
        test_date = "2099-12-31"  # Future date to avoid conflicts
        
        # Create a test reassignment
        if self.assignments:
            assignment = self.assignments[0]
            shift_id = assignment.get('shifts', [{}])[0].get('id', 'test-shift') if assignment.get('shifts') else 'test-shift'
            
            payload = {
                "date": test_date,
                "assignment_id": assignment['id'],
                "shift_id": shift_id,
                "block_id": None,
                "original_employee_id": assignment.get('employee_id'),
                "new_employee_id": None
            }
            requests.post(f"{BASE_URL}/api/temporary-reassignments", json=payload)
        
        # Delete by date
        response = requests.delete(f"{BASE_URL}/api/temporary-reassignments/by-date/{test_date}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestScheduleAPI:
    """P0 - Test schedule API with replacements and reassignment_index"""
    
    def test_get_schedule(self):
        """Test GET /api/schedule returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "schedule" in data
        assert "replacements" in data
        assert "week_dates" in data
        assert "reassignment_index" in data
        
        # Check replacements structure
        replacements = data["replacements"]
        assert "unassigned_assignments" in replacements
        assert "absent_items" in replacements
    
    def test_get_schedule_with_week_start(self):
        """Test GET /api/schedule with week_start parameter"""
        # Get Monday of current week
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')
        
        response = requests.get(f"{BASE_URL}/api/schedule?week_start={week_start}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify week_dates are correct
        assert len(data["week_dates"]) == 5  # Monday to Friday
        assert data["week_dates"][0] == week_start
    
    def test_schedule_contains_reassignment_index(self):
        """Test that schedule response includes reassignment_index for tracking temp reassignments"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        assert "reassignment_index" in data
        assert isinstance(data["reassignment_index"], dict)


class TestAssignmentsAPI:
    """P1 - Test assignments API including is_adapted field"""
    
    def test_get_assignments(self):
        """Test GET /api/assignments"""
        response = requests.get(f"{BASE_URL}/api/assignments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_assignment_with_adapted(self):
        """Test creating assignment with is_adapted=True"""
        today = datetime.now().strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        payload = {
            "circuit_number": "TEST-999",
            "shifts": [],
            "employee_id": None,
            "start_date": today,
            "end_date": end_date,
            "is_adapted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/assignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["circuit_number"] == "TEST-999"
        assert data["is_adapted"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/assignments/{data['id']}")
    
    def test_create_assignment_without_adapted(self):
        """Test creating assignment with is_adapted=False (default)"""
        today = datetime.now().strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        payload = {
            "circuit_number": "TEST-888",
            "shifts": [],
            "employee_id": None,
            "start_date": today,
            "end_date": end_date,
            "is_adapted": False
        }
        
        response = requests.post(f"{BASE_URL}/api/assignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_adapted"] == False
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/assignments/{data['id']}")


class TestAbsencesAPI:
    """P2 - Test absences API for absent driver circuit display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get employees for testing"""
        emp_response = requests.get(f"{BASE_URL}/api/employees")
        self.employees = emp_response.json() if emp_response.status_code == 200 else []
    
    def test_get_absences(self):
        """Test GET /api/absences"""
        response = requests.get(f"{BASE_URL}/api/absences")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_absence(self):
        """Test creating an absence"""
        if not self.employees:
            pytest.skip("No employees to test with")
        
        employee = self.employees[0]
        today = datetime.now().strftime('%Y-%m-%d')
        
        payload = {
            "employee_id": employee['id'],
            "start_date": today,
            "end_date": today,
            "reason": "Test absence",
            "shift_types": []
        }
        
        response = requests.post(f"{BASE_URL}/api/absences", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["employee_id"] == employee['id']
        assert data["employee_name"] == employee['name']
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/absences/{data['id']}")


class TestEmployeesAPI:
    """Test employees API"""
    
    def test_get_employees(self):
        """Test GET /api/employees"""
        response = requests.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestSchoolsAPI:
    """Test schools API"""
    
    def test_get_schools(self):
        """Test GET /api/schools"""
        response = requests.get(f"{BASE_URL}/api/schools")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestHolidaysAPI:
    """Test holidays API"""
    
    def test_get_holidays(self):
        """Test GET /api/holidays"""
        response = requests.get(f"{BASE_URL}/api/holidays")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
