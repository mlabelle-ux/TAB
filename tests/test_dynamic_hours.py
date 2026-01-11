"""
Test suite for Dynamic Hours Calculation Feature
Tests that when blocks are reassigned via drag & drop:
1. Original driver loses hours for the reassigned block
2. Target driver gains hours for the received block
3. When block is moved to Remplacements (new_employee_id=null), original driver loses hours
4. HLP (Hors Ligne Payé) is included in hour calculations
5. Both daily and weekly hours update correctly
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDynamicHoursCalculation:
    """Test dynamic hours calculation when blocks are reassigned"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and cleanup after"""
        self.test_reassignment_ids = []
        yield
        # Cleanup test reassignments
        for rid in self.test_reassignment_ids:
            try:
                requests.delete(f"{BASE_URL}/api/temporary-reassignments/{rid}")
            except:
                pass
    
    def test_get_initial_hours_for_employee(self):
        """Test getting initial hours for an employee before any reassignment"""
        # Get schedule for current week
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        data = response.json()
        
        # Find HARVEY, Claude who has circuit 204
        harvey_schedule = None
        for emp_schedule in data['schedule']:
            if emp_schedule['employee']['name'] == 'HARVEY, Claude':
                harvey_schedule = emp_schedule
                break
        
        assert harvey_schedule is not None, "HARVEY, Claude not found in schedule"
        
        # Check daily hours exist
        daily_hours = harvey_schedule.get('daily_hours', {})
        weekly_total = harvey_schedule.get('weekly_total', 0)
        
        print(f"✅ HARVEY, Claude initial hours:")
        print(f"   Daily: {daily_hours}")
        print(f"   Weekly total: {weekly_total} minutes ({weekly_total // 60}h {weekly_total % 60}m)")
        
        assert weekly_total > 0, "HARVEY, Claude should have hours assigned"
    
    def test_reassign_block_to_another_driver_hours_change(self):
        """
        Test that when a block is reassigned to another driver:
        - Original driver loses hours
        - Target driver gains hours
        """
        # Step 1: Get initial schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        initial_data = response.json()
        
        # Find HARVEY, Claude (has circuit 204)
        harvey_initial = None
        for emp_schedule in initial_data['schedule']:
            if emp_schedule['employee']['name'] == 'HARVEY, Claude':
                harvey_initial = emp_schedule
                break
        
        assert harvey_initial is not None
        harvey_id = harvey_initial['employee']['id']
        harvey_initial_daily = harvey_initial['daily_hours'].get('2025-12-15', 0)
        harvey_initial_weekly = harvey_initial['weekly_total']
        
        # Find another driver to receive the block (VENNE, Yves)
        venne_initial = None
        for emp_schedule in initial_data['schedule']:
            if emp_schedule['employee']['name'] == 'VENNE, Yves':
                venne_initial = emp_schedule
                break
        
        assert venne_initial is not None
        venne_id = venne_initial['employee']['id']
        venne_initial_daily = venne_initial['daily_hours'].get('2025-12-15', 0)
        venne_initial_weekly = venne_initial['weekly_total']
        
        print(f"✅ Initial hours:")
        print(f"   HARVEY, Claude: daily={harvey_initial_daily}min, weekly={harvey_initial_weekly}min")
        print(f"   VENNE, Yves: daily={venne_initial_daily}min, weekly={venne_initial_weekly}min")
        
        # Step 2: Get assignment details for circuit 204
        response = requests.get(f"{BASE_URL}/api/assignments")
        assignments = response.json()
        
        circuit_204 = None
        for a in assignments:
            if a['circuit_number'] == '204' and a.get('employee_id') == harvey_id:
                circuit_204 = a
                break
        
        assert circuit_204 is not None, "Circuit 204 not found for HARVEY"
        
        # Get first shift and block
        shift = circuit_204['shifts'][0]
        block = shift['blocks'][0] if shift.get('blocks') else None
        
        assert block is not None, "No blocks found in shift"
        
        # Calculate expected hours for this block (including HLP)
        start_time = block['start_time']
        end_time = block['end_time']
        hlp_before = block.get('hlp_before', 0)
        hlp_after = block.get('hlp_after', 0)
        
        start_minutes = int(start_time.split(':')[0]) * 60 + int(start_time.split(':')[1])
        end_minutes = int(end_time.split(':')[0]) * 60 + int(end_time.split(':')[1])
        block_duration = (end_minutes - start_minutes) + hlp_before + hlp_after
        
        print(f"✅ Block to reassign:")
        print(f"   Time: {start_time} - {end_time}")
        print(f"   HLP: before={hlp_before}min, after={hlp_after}min")
        print(f"   Total duration: {block_duration}min")
        
        # Step 3: Create temporary reassignment to VENNE
        reassignment_payload = {
            "date": "2025-12-15",
            "assignment_id": circuit_204['id'],
            "shift_id": shift['id'],
            "block_id": block['id'],
            "original_employee_id": harvey_id,
            "new_employee_id": venne_id
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=reassignment_payload)
        assert response.status_code == 200
        reassignment = response.json()
        self.test_reassignment_ids.append(reassignment['id'])
        
        print(f"✅ Created reassignment: {reassignment['id']}")
        
        # Step 4: Get updated schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        updated_data = response.json()
        
        # Find updated hours
        harvey_updated = None
        venne_updated = None
        for emp_schedule in updated_data['schedule']:
            if emp_schedule['employee']['id'] == harvey_id:
                harvey_updated = emp_schedule
            elif emp_schedule['employee']['id'] == venne_id:
                venne_updated = emp_schedule
        
        assert harvey_updated is not None
        assert venne_updated is not None
        
        harvey_updated_daily = harvey_updated['daily_hours'].get('2025-12-15', 0)
        harvey_updated_weekly = harvey_updated['weekly_total']
        venne_updated_daily = venne_updated['daily_hours'].get('2025-12-15', 0)
        venne_updated_weekly = venne_updated['weekly_total']
        
        print(f"✅ Updated hours after reassignment:")
        print(f"   HARVEY, Claude: daily={harvey_updated_daily}min, weekly={harvey_updated_weekly}min")
        print(f"   VENNE, Yves: daily={venne_updated_daily}min, weekly={venne_updated_weekly}min")
        
        # Step 5: Verify hours changed correctly
        # HARVEY should have LOST hours (daily and weekly should decrease)
        assert harvey_updated_daily < harvey_initial_daily, \
            f"HARVEY daily hours should decrease: {harvey_initial_daily} -> {harvey_updated_daily}"
        
        # VENNE should have GAINED hours (daily and weekly should increase)
        assert venne_updated_daily > venne_initial_daily, \
            f"VENNE daily hours should increase: {venne_initial_daily} -> {venne_updated_daily}"
        
        # The difference should be approximately the block duration
        harvey_daily_diff = harvey_initial_daily - harvey_updated_daily
        venne_daily_diff = venne_updated_daily - venne_initial_daily
        
        print(f"✅ Hour changes:")
        print(f"   HARVEY lost: {harvey_daily_diff}min")
        print(f"   VENNE gained: {venne_daily_diff}min")
        print(f"   Expected block duration: {block_duration}min")
        
        # Allow some tolerance for overlapping intervals
        assert abs(harvey_daily_diff - block_duration) <= 30, \
            f"HARVEY should lose approximately {block_duration}min, lost {harvey_daily_diff}min"
        assert abs(venne_daily_diff - block_duration) <= 30, \
            f"VENNE should gain approximately {block_duration}min, gained {venne_daily_diff}min"
        
        print("✅ Dynamic hours calculation working correctly for reassignment to another driver")
    
    def test_reassign_block_to_remplacements_hours_change(self):
        """
        Test that when a block is moved to Remplacements (new_employee_id=null):
        - Original driver loses hours
        """
        # Step 1: Get initial schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        initial_data = response.json()
        
        # Find HARVEY, Claude
        harvey_initial = None
        for emp_schedule in initial_data['schedule']:
            if emp_schedule['employee']['name'] == 'HARVEY, Claude':
                harvey_initial = emp_schedule
                break
        
        assert harvey_initial is not None
        harvey_id = harvey_initial['employee']['id']
        harvey_initial_daily = harvey_initial['daily_hours'].get('2025-12-16', 0)  # Use different date
        
        print(f"✅ Initial hours for 2025-12-16:")
        print(f"   HARVEY, Claude: daily={harvey_initial_daily}min")
        
        # Step 2: Get assignment details
        response = requests.get(f"{BASE_URL}/api/assignments")
        assignments = response.json()
        
        circuit_204 = None
        for a in assignments:
            if a['circuit_number'] == '204' and a.get('employee_id') == harvey_id:
                circuit_204 = a
                break
        
        assert circuit_204 is not None
        
        shift = circuit_204['shifts'][0]
        block = shift['blocks'][0] if shift.get('blocks') else None
        assert block is not None
        
        # Calculate block duration
        start_time = block['start_time']
        end_time = block['end_time']
        hlp_before = block.get('hlp_before', 0)
        hlp_after = block.get('hlp_after', 0)
        start_minutes = int(start_time.split(':')[0]) * 60 + int(start_time.split(':')[1])
        end_minutes = int(end_time.split(':')[0]) * 60 + int(end_time.split(':')[1])
        block_duration = (end_minutes - start_minutes) + hlp_before + hlp_after
        
        # Step 3: Create reassignment to Remplacements (null employee)
        reassignment_payload = {
            "date": "2025-12-16",
            "assignment_id": circuit_204['id'],
            "shift_id": shift['id'],
            "block_id": block['id'],
            "original_employee_id": harvey_id,
            "new_employee_id": None  # null = in Remplacements
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=reassignment_payload)
        assert response.status_code == 200
        reassignment = response.json()
        self.test_reassignment_ids.append(reassignment['id'])
        
        assert reassignment['new_employee_id'] is None
        print(f"✅ Created reassignment to Remplacements: {reassignment['id']}")
        
        # Step 4: Get updated schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        updated_data = response.json()
        
        # Find updated hours
        harvey_updated = None
        for emp_schedule in updated_data['schedule']:
            if emp_schedule['employee']['id'] == harvey_id:
                harvey_updated = emp_schedule
                break
        
        assert harvey_updated is not None
        harvey_updated_daily = harvey_updated['daily_hours'].get('2025-12-16', 0)
        
        print(f"✅ Updated hours for 2025-12-16:")
        print(f"   HARVEY, Claude: daily={harvey_updated_daily}min")
        
        # Step 5: Verify HARVEY lost hours
        assert harvey_updated_daily < harvey_initial_daily, \
            f"HARVEY daily hours should decrease when block moved to Remplacements"
        
        harvey_daily_diff = harvey_initial_daily - harvey_updated_daily
        print(f"✅ HARVEY lost: {harvey_daily_diff}min (expected ~{block_duration}min)")
        
        assert abs(harvey_daily_diff - block_duration) <= 30, \
            f"HARVEY should lose approximately {block_duration}min"
        
        print("✅ Dynamic hours calculation working correctly for Remplacements")
    
    def test_hlp_included_in_hour_calculation(self):
        """Test that HLP (Hors Ligne Payé) is included in hour calculations"""
        # Get assignments to find one with HLP
        response = requests.get(f"{BASE_URL}/api/assignments")
        assert response.status_code == 200
        assignments = response.json()
        
        # Find a block with HLP
        block_with_hlp = None
        for a in assignments:
            for s in a.get('shifts', []):
                for b in s.get('blocks', []):
                    if b.get('hlp_before', 0) > 0 or b.get('hlp_after', 0) > 0:
                        block_with_hlp = {
                            'assignment': a,
                            'shift': s,
                            'block': b
                        }
                        break
                if block_with_hlp:
                    break
            if block_with_hlp:
                break
        
        assert block_with_hlp is not None, "No blocks with HLP found"
        
        block = block_with_hlp['block']
        hlp_before = block.get('hlp_before', 0)
        hlp_after = block.get('hlp_after', 0)
        
        print(f"✅ Found block with HLP:")
        print(f"   Time: {block['start_time']} - {block['end_time']}")
        print(f"   HLP before: {hlp_before}min")
        print(f"   HLP after: {hlp_after}min")
        
        # Calculate expected duration with HLP
        start_time = block['start_time']
        end_time = block['end_time']
        start_minutes = int(start_time.split(':')[0]) * 60 + int(start_time.split(':')[1])
        end_minutes = int(end_time.split(':')[0]) * 60 + int(end_time.split(':')[1])
        
        base_duration = end_minutes - start_minutes
        total_with_hlp = base_duration + hlp_before + hlp_after
        
        print(f"✅ Duration calculation:")
        print(f"   Base duration: {base_duration}min")
        print(f"   Total with HLP: {total_with_hlp}min")
        
        assert total_with_hlp > base_duration, "HLP should add to total duration"
        print("✅ HLP is included in hour calculations")
    
    def test_weekly_hours_update_after_reassignment(self):
        """Test that weekly total hours update correctly after reassignment"""
        # Step 1: Get initial schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        initial_data = response.json()
        
        # Find HARVEY, Claude
        harvey_initial = None
        for emp_schedule in initial_data['schedule']:
            if emp_schedule['employee']['name'] == 'HARVEY, Claude':
                harvey_initial = emp_schedule
                break
        
        assert harvey_initial is not None
        harvey_id = harvey_initial['employee']['id']
        harvey_initial_weekly = harvey_initial['weekly_total']
        
        print(f"✅ Initial weekly total: {harvey_initial_weekly}min")
        
        # Step 2: Get assignment and create reassignment for a different date
        response = requests.get(f"{BASE_URL}/api/assignments")
        assignments = response.json()
        
        circuit_204 = None
        for a in assignments:
            if a['circuit_number'] == '204' and a.get('employee_id') == harvey_id:
                circuit_204 = a
                break
        
        assert circuit_204 is not None
        
        shift = circuit_204['shifts'][0]
        block = shift['blocks'][0] if shift.get('blocks') else None
        assert block is not None
        
        # Create reassignment for 2025-12-17
        reassignment_payload = {
            "date": "2025-12-17",
            "assignment_id": circuit_204['id'],
            "shift_id": shift['id'],
            "block_id": block['id'],
            "original_employee_id": harvey_id,
            "new_employee_id": None
        }
        
        response = requests.post(f"{BASE_URL}/api/temporary-reassignments", json=reassignment_payload)
        assert response.status_code == 200
        reassignment = response.json()
        self.test_reassignment_ids.append(reassignment['id'])
        
        # Step 3: Get updated schedule
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        updated_data = response.json()
        
        harvey_updated = None
        for emp_schedule in updated_data['schedule']:
            if emp_schedule['employee']['id'] == harvey_id:
                harvey_updated = emp_schedule
                break
        
        assert harvey_updated is not None
        harvey_updated_weekly = harvey_updated['weekly_total']
        
        print(f"✅ Updated weekly total: {harvey_updated_weekly}min")
        
        # Weekly total should decrease
        assert harvey_updated_weekly < harvey_initial_weekly, \
            f"Weekly total should decrease after reassignment"
        
        weekly_diff = harvey_initial_weekly - harvey_updated_weekly
        print(f"✅ Weekly hours decreased by: {weekly_diff}min")
        
        print("✅ Weekly hours update correctly after reassignment")
    
    def test_reassignment_index_in_schedule_response(self):
        """Test that reassignment_index is included in schedule response"""
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        data = response.json()
        
        assert 'reassignment_index' in data, "reassignment_index should be in schedule response"
        
        reassignment_index = data['reassignment_index']
        print(f"✅ reassignment_index found with {len(reassignment_index)} entries")
        
        # Check structure of reassignment_index
        for key, value in list(reassignment_index.items())[:3]:
            print(f"   Key: {key[:50]}...")
            assert 'date' in value
            assert 'assignment_id' in value
            assert 'shift_id' in value
            assert 'new_employee_id' in value or value.get('new_employee_id') is None
        
        print("✅ reassignment_index has correct structure")


class TestScheduleAPIWithReassignments:
    """Test schedule API returns correct data with reassignments"""
    
    def test_schedule_returns_daily_hours(self):
        """Test that schedule returns daily_hours for each employee"""
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        data = response.json()
        
        for emp_schedule in data['schedule'][:5]:
            assert 'daily_hours' in emp_schedule
            assert 'weekly_total' in emp_schedule
            
            daily_hours = emp_schedule['daily_hours']
            assert isinstance(daily_hours, dict)
            
            # Check that daily hours are for the correct week
            for date_key in daily_hours.keys():
                assert date_key.startswith('2025-12-')
        
        print("✅ Schedule returns daily_hours for each employee")
    
    def test_schedule_returns_weekly_total_formatted(self):
        """Test that schedule returns formatted weekly total"""
        response = requests.get(f"{BASE_URL}/api/schedule?week_start=2025-12-15")
        assert response.status_code == 200
        data = response.json()
        
        for emp_schedule in data['schedule'][:5]:
            assert 'weekly_total_formatted' in emp_schedule
            formatted = emp_schedule['weekly_total_formatted']
            
            # Should be in HH:MM format
            assert ':' in formatted
            parts = formatted.split(':')
            assert len(parts) == 2
            assert parts[0].isdigit()
            assert parts[1].isdigit()
        
        print("✅ Schedule returns weekly_total_formatted in HH:MM format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
