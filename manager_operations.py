import sqlite3
from datetime import datetime

class ManagerOperations:
    def __init__(self, db_path="student_project.db"):
        self.db_path = db_path


    def set_priority(self, group_id, project_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT ProjectID FROM projects WHERE ProjectID = ?", (project_id,))
                if not cursor.fetchone():
                    return {'success': False, 'message': 'Project not found'}
                
                cursor.execute("""
                    SELECT ProjectCapacity,
                           (SELECT COUNT(*) FROM priority_allocations WHERE ProjectID = ?) as used
                    FROM projects WHERE ProjectID = ?
                """, (project_id, project_id))
                
                result = cursor.fetchone()
                if not result:
                    return {'success': False, 'message': 'Project not found'}
                
                capacity, used = result
                if used >= capacity:
                    return {'success': False, 'message': 'Project capacity exceeded'}
                
                # Set priority allocation
                cursor.execute("""
                    INSERT OR REPLACE INTO priority_allocations (GroupID, ProjectID)
                    VALUES (?, ?)
                """, (group_id, project_id))
                
                conn.commit()
                return {'success': True, 'message': 'Priority set successfully'}
                
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def remove_priority(self, group_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM priority_allocations WHERE GroupID = ?", (group_id,))
                
                if cursor.rowcount == 0:
                    return {'success': False, 'message': 'No priority allocation found for this group'}
                
                conn.commit()
                return {'success': True, 'message': 'Priority removed successfully'}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_priorities(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT pa.GroupID, g.GroupName, pa.ProjectID, p.ProjectName, pa.CreatedAt
                    FROM priority_allocations pa
                    LEFT JOIN groups g ON pa.GroupID = g.GroupID
                    LEFT JOIN projects p ON pa.ProjectID = p.ProjectID
                    ORDER BY pa.CreatedAt DESC
                """)
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        'group_id': row[0],
                        'group_name': row[1] or f"Group {row[0]}",
                        'project_id': row[2],
                        'project_name': row[3] or "Unknown Project",
                        'created_at': row[4]
                    })
                return results
        except Exception as e:
            return []

    
    def change_allocation(self, group_id, new_project_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if group is currently allocated
                cursor.execute("SELECT ProjectID FROM results WHERE GroupID = ?", (group_id,))
                current_result = cursor.fetchone()
                if not current_result:
                    return {'success': False, 'message': 'Group is not currently allocated'}
                
                old_project_id = current_result[0]
                
                # Check if new project exists
                cursor.execute("SELECT ProjectID FROM projects WHERE ProjectID = ?", (new_project_id,))
                if not cursor.fetchone():
                    return {'success': False, 'message': 'New project not found'}
                
                # Check new project capacity
                cursor.execute("""
                    SELECT ProjectCapacity,
                           (SELECT COUNT(*) FROM results WHERE ProjectID = ?) as used
                    FROM projects WHERE ProjectID = ?
                """, (new_project_id, new_project_id))
                
                result = cursor.fetchone()
                if not result:
                    return {'success': False, 'message': 'Project not found'}
                
                capacity, used = result
                if used >= capacity:
                    return {'success': False, 'message': 'New project is full'}
                
                # Calculate new score
                from allocation import ProjectAllocator
                allocator = ProjectAllocator(self.db_path)
                new_score = allocator.calculate_final_score(cursor, group_id, new_project_id)
                
                # Check preference rank
                cursor.execute("""
                    SELECT PreferenceNumber FROM group_preferences 
                    WHERE GroupID = ? AND ProjectID = ?
                """, (group_id, new_project_id))
                pref_result = cursor.fetchone()
                pref_rank = pref_result[0] if pref_result else None
                
                # Update results table
                cursor.execute("""
                    UPDATE results 
                    SET ProjectID = ?, Score = ?, PreferenceRank = ?
                    WHERE GroupID = ?
                """, (new_project_id, new_score, pref_rank, group_id))
                
                # Update groups.allocated_project
                cursor.execute("""
                    UPDATE groups 
                    SET allocated_project = ?
                    WHERE GroupID = ?
                """, (new_project_id, group_id))
                
                conn.commit()
                return {
                    'success': True, 
                    'message': f'Allocation changed from {old_project_id} to {new_project_id}'
                }
                
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def swap_groups(self, group1_id, group2_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get current allocations
                cursor.execute("""
                    SELECT GroupID, ProjectID, Score, PreferenceRank 
                    FROM results 
                    WHERE GroupID IN (?, ?)
                """, (group1_id, group2_id))
                
                results = cursor.fetchall()
                if len(results) != 2:
                    return {'success': False, 'message': 'Both groups must be allocated'}
                
                # Create allocation mapping
                allocations = {}
                for row in results:
                    allocations[row[0]] = {
                        'project_id': row[1],
                        'score': row[2],
                        'pref_rank': row[3]
                    }
                
                # Calculate new scores for swapped allocations
                from allocation import ProjectAllocator
                allocator = ProjectAllocator(self.db_path)
                
                # Group 1 gets Group 2's project
                new_score_1 = allocator.calculate_final_score(
                    cursor, group1_id, allocations[group2_id]['project_id']
                )
                
                # Group 2 gets Group 1's project
                new_score_2 = allocator.calculate_final_score(
                    cursor, group2_id, allocations[group1_id]['project_id']
                )
                
                # Check preference ranks for new allocations
                cursor.execute("""
                    SELECT PreferenceNumber FROM group_preferences 
                    WHERE GroupID = ? AND ProjectID = ?
                """, (group1_id, allocations[group2_id]['project_id']))
                pref_result_1 = cursor.fetchone()
                pref_rank_1 = pref_result_1[0] if pref_result_1 else None
                
                cursor.execute("""
                    SELECT PreferenceNumber FROM group_preferences 
                    WHERE GroupID = ? AND ProjectID = ?
                """, (group2_id, allocations[group1_id]['project_id']))
                pref_result_2 = cursor.fetchone()
                pref_rank_2 = pref_result_2[0] if pref_result_2 else None
                
                # Update results table
                cursor.execute("""
                    UPDATE results 
                    SET ProjectID = ?, Score = ?, PreferenceRank = ?
                    WHERE GroupID = ?
                """, (allocations[group2_id]['project_id'], new_score_1, pref_rank_1, group1_id))
                
                cursor.execute("""
                    UPDATE results 
                    SET ProjectID = ?, Score = ?, PreferenceRank = ?
                    WHERE GroupID = ?
                """, (allocations[group1_id]['project_id'], new_score_2, pref_rank_2, group2_id))
                
                # Update groups.allocated_project
                cursor.execute("""
                    UPDATE groups 
                    SET allocated_project = ?
                    WHERE GroupID = ?
                """, (allocations[group2_id]['project_id'], group1_id))
                
                cursor.execute("""
                    UPDATE groups 
                    SET allocated_project = ?
                    WHERE GroupID = ?
                """, (allocations[group1_id]['project_id'], group2_id))
                
                conn.commit()
                return {
                    'success': True, 
                    'message': f'Groups {group1_id} and {group2_id} swapped successfully'
                }
                
        except Exception as e:
            return {'success': False, 'message': str(e)}

    
    def get_group_allocation(self, group_id):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT r.ProjectID, p.ProjectName, r.Score, r.PreferenceRank
                    FROM results r
                    LEFT JOIN projects p ON r.ProjectID = p.ProjectID
                    WHERE r.GroupID = ?
                """, (group_id,))
                
                result = cursor.fetchone()
                if result:
                    return {
                        'success': True,
                        'data': {
                            'project_id': result[0],
                            'project_name': result[1],
                            'score': result[2],
                            'preference_rank': result[3]
                        }
                    }
                else:
                    return {'success': False, 'data': None, 'message': 'Group not allocated'}
        except Exception as e:
            return {'success': False, 'data': None, 'message': str(e)}