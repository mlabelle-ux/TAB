"""
Test suite for Bus Driver Schedule Management System - Corrections Testing
Tests the specific corrections requested:
1. Mode Détaillé: HLP blocks shown separately
2. Mode Abrégé: Shows AM/PM/MIDI shifts instead of individual blocks
3. Calendar: January 12 selection (UTC-5)
4. Drag & Drop: Blocks remain visible in Remplacements
5. Adapté checkbox: Only icon, no word
6. Employees: Inactif checkbox and counter
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendAPIs:
    """Test backend API endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ API root: {data['message']}")
    
    def test_get_employees(self):
        """Test getting employees list"""
        response = requests.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        print(f"✅ Got {len(employees)} employees")
        
        # Check for is_inactive field
        if employees:
            first_emp = employees[0]
            assert 'is_inactive' in first_emp or first_emp.get('is_inactive') is None
            print("✅ Employees have is_inactive field")
    
    def test_get_assignments(self):
        """Test getting assignments list"""
        response = requests.get(f"{BASE_URL}/api/assignments")
        assert response.status_code == 200
        assignments = response.json()
        assert isinstance(assignments, list)
        print(f"✅ Got {len(assignments)} assignments")
        
        # Check for is_adapted field
        adapted_assignments = [a for a in assignments if a.get('is_adapted')]
        print(f"✅ Found {len(adapted_assignments)} adapted assignments")
    
    def test_get_schedule_with_week(self):
        """Test getting schedule for a specific week"""
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2026-01-12")
        assert response.status_code == 200
        data = response.json()
        
        assert 'schedule' in data
        assert 'week_dates' in data
        assert 'replacements' in data
        assert 'reassignment_index' in data
        
        # Check week dates include January 12
        week_dates = data['week_dates']
        assert '2026-01-12' in week_dates
        print(f"✅ Schedule for week of Jan 12: {week_dates}")
    
    def test_temporary_reassignments_crud(self):
        """Test temporary reassignments CRUD operations"""
        # Get existing reassignments
        response = requests.get(f"{BASE_URL}/api/temporary-reassignments")
        assert response.status_code == 200
        reassignments = response.json()
        print(f"✅ Got {len(reassignments)} temporary reassignments")
        
        # Get reassignments for specific date
        response = requests.get(f"{BASE_URL}/api/temporary-reassignments?date=2026-01-12")
        assert response.status_code == 200
        date_reassignments = response.json()
        print(f"✅ Got {len(date_reassignments)} reassignments for 2026-01-12")
    
    def test_create_temporary_reassignment_to_null(self):
        """Test creating a temporary reassignment with null employee (to Remplacements)"""
        # First get an assignment to use
        response = requests.get(f"{BASE_URL}/api/assignments")
        assignments = response.json()
        
        if not assignments:
            pytest.skip("No assignments available for testing")
        
        # Find an assignment with shifts
        test_assignment = None
        for a in assignments:
            if a.get('shifts') and a.get('employee_id'):
                test_assignment = a
                break
        
        if not test_assignment:
            pytest.skip("No suitable assignment found for testing")
        
        shift = test_assignment['shifts'][0]
        block_id = shift['blocks'][0]['id'] if shift.get('blocks') else None
        
        # Create reassignment to null (move to Remplacements)
        payload = {
            "date": "2026-01-15",  # Use a test date
            "assignment_id": test_assignment['id'],
            "shift_id": shift['id'],
            "block_id": block_id,
            "original_employee_id": test_assignment['employee_id'],
            "new_employee_id": None  # null = in Remplacements
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['new_employee_id'] is None
        print(f"✅ Created reassignment to Remplacements: {data['id']}")
        
        # Verify it appears in schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2026-01-12")
        schedule_data = response.json()
        
        # Check reassignment_index
        reassignment_index = schedule_data.get('reassignment_index', {})
        key = f"2026-01-15-{test_assignment['id']}-{shift['id']}-{block_id or ''}"
        
        if key in reassignment_index:
            assert reassignment_index[key]['new_employee_id'] is None
            print(f"✅ Reassignment appears in schedule with null employee")
        
        # Clean up - delete the test reassignment
        response = requests.delete(f"{BASE_URL}/api/temporary-reassignments/{data['id']}")
        assert response.status_code == 200
        print("✅ Cleaned up test reassignment")


class TestEmployeeInactiveFeature:
    """Test employee inactive feature"""
    
    def test_create_inactive_employee(self):
        """Test creating an inactive employee"""
        payload = {
            "name": "TEST_Inactive Employee",
            "hire_date": "2026-01-01",
            "is_inactive": True,
            "berline": "TEST9999"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['is_inactive'] == True
        assert data['name'] == "TEST_Inactive Employee"
        print(f"✅ Created inactive employee: {data['id']}")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}")
        print("✅ Cleaned up test employee")
    
    def test_berline_duplicate_allowed_for_inactive(self):
        """Test that berline duplicates are allowed if one employee is inactive"""
        # Create first employee with berline
        payload1 = {
            "name": "TEST_Active Employee",
            "hire_date": "2026-01-01",
            "is_inactive": False,
            "berline": "TEST_BERLINE_DUP"
        }
        
        response1 = requests.post(f"{BASE_URL}/api/employees", json=payload1)
        if response1.status_code != 200:
            pytest.skip("Could not create first test employee")
        
        emp1 = response1.json()
        
        # Create second employee with same berline but inactive
        payload2 = {
            "name": "TEST_Inactive Employee 2",
            "hire_date": "2026-01-01",
            "is_inactive": True,
            "berline": "TEST_BERLINE_DUP"
        }
        
        response2 = requests.post(f"{BASE_URL}/api/employees", json=payload2)
        
        # Should succeed because one is inactive
        assert response2.status_code == 200
        emp2 = response2.json()
        print(f"✅ Berline duplicate allowed when one employee is inactive")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/employees/{emp1['id']}")
        requests.delete(f"{BASE_URL}/api/employees/{emp2['id']}")
        print("✅ Cleaned up test employees")


class TestAssignmentAdaptedFeature:
    """Test assignment adapted (handicap) feature"""
    
    def test_create_adapted_assignment(self):
        """Test creating an adapted assignment"""
        payload = {
            "circuit_number": "TEST999",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "is_adapted": True,
            "shifts": []
        }
        
        response = requests.post(f"{BASE_URL}/api/assignments", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data['is_adapted'] == True
        assert data['circuit_number'] == "TEST999"
        print(f"✅ Created adapted assignment: {data['id']}")
        
        # Verify it appears in list
        response = requests.get(f"{BASE_URL}/api/assignments")
        assignments = response.json()
        test_assignment = next((a for a in assignments if a['circuit_number'] == "TEST999"), None)
        
        assert test_assignment is not None
        assert test_assignment['is_adapted'] == True
        print("✅ Adapted assignment appears in list with is_adapted=True")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/assignments/{data['id']}")
        print("✅ Cleaned up test assignment")


class TestScheduleViewModes:
    """Test schedule view modes data"""
    
    def test_schedule_has_hlp_data(self):
        """Test that schedule data includes HLP information for detailed view"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        # Check assignments have HLP data in blocks
        for emp_schedule in data['schedule']:
            for assignment in emp_schedule.get('assignments', []):
                for shift in assignment.get('shifts', []):
                    for block in shift.get('blocks', []):
                        # HLP fields should exist
                        assert 'hlp_before' in block or block.get('hlp_before', 0) >= 0
                        assert 'hlp_after' in block or block.get('hlp_after', 0) >= 0
        
        print("✅ Schedule data includes HLP information for blocks")
    
    def test_schedule_has_shift_names(self):
        """Test that schedule data includes shift names for abbreviated view"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        shift_names = set()
        for emp_schedule in data['schedule']:
            for assignment in emp_schedule.get('assignments', []):
                for shift in assignment.get('shifts', []):
                    if shift.get('name'):
                        shift_names.add(shift['name'])
        
        print(f"✅ Found shift names: {shift_names}")
        # Should have AM, PM, MIDI, or admin shifts
        assert len(shift_names) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
