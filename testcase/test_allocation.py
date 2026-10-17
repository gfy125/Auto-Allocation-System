import sqlite3
import sys
import os
import unittest
from datetime import datetime

DB_PATH = "student_project.db"
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestAllocationSystem(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.db_path = DB_PATH      
    
    def create_allocator(self):
        try:
            from allocation import ProjectAllocator
            return ProjectAllocator(db_path=self.db_path)
        except ImportError as e:
            self.skipTest(f"Cannot import ProjectAllocator: {e}")
    
    def create_manager(self):
        try:
            from manager_operations import ManagerOperations
            return ManagerOperations(db_path=self.db_path)
        except ImportError as e:
            self.skipTest(f"Cannot import ManagerOperations: {e}")
    
    def create_reporter(self):
        try:
            from report import AllocationReporter
            return AllocationReporter(db_path=self.db_path)
        except ImportError as e:
            self.skipTest(f"Cannot import AllocationReporter: {e}")
    
    def test_database_exists(self):
        """Test that the database exists and has required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            required_tables = ['groups', 'projects', 'group_preferences', 'skills', 'group_skills']
            for table in required_tables:
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                """, (table,))
                result = cursor.fetchone()
                self.assertIsNotNone(result, f"Table {table} not found")
    
    def test_basic_data_integrity(self):
        """Test that the database contains valid data"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM groups")
            group_count = cursor.fetchone()[0]
            self.assertGreater(group_count, 0, "No groups found in database")
            
            cursor.execute("SELECT COUNT(*) FROM projects")
            project_count = cursor.fetchone()[0]
            self.assertGreater(project_count, 0, "No projects found in database")
            
            cursor.execute("SELECT COUNT(*) FROM group_preferences")
            pref_count = cursor.fetchone()[0]
            self.assertGreater(pref_count, 0, "No preferences found in database")
            
            cursor.execute("""
                SELECT COUNT(*) FROM group_preferences gp
                LEFT JOIN groups g ON gp.GroupID = g.GroupID
                WHERE g.GroupID IS NULL
            """)
            orphaned_prefs = cursor.fetchone()[0]
            if orphaned_prefs > 0:
                print(f"WARNING: Found {orphaned_prefs} orphaned preferences (groups don't exist)")
            
            cursor.execute("""
                SELECT COUNT(*) FROM group_preferences gp
                LEFT JOIN projects p ON gp.ProjectID = p.ProjectID
                WHERE p.ProjectID IS NULL
            """)
            invalid_projects = cursor.fetchone()[0]
            if invalid_projects > 0:
                print(f"WARNING: Found {invalid_projects} preferences with invalid project IDs")
            
            print(f"Database contains: {group_count} groups, {project_count} projects, {pref_count} preferences")
    
    def test_allocation_algorithm(self):
        """Test the main allocation algorithm"""
        allocator = self.create_allocator()
        
        try:
            result = allocator.final_allocation()
            
            self.assertIsInstance(result, dict, "final_allocation should return a dict")
            self.assertIn('success', result, "Result should contain 'success' key")
            self.assertIn('message', result, "Result should contain 'message' key")
            
            if result['success']:
                print("Allocation completed successfully")
                
                # Verify results were saved to database
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM results")
                    result_count = cursor.fetchone()[0]
                    self.assertGreater(result_count, 0, "No results found after allocation")
                    print(f"Allocated {result_count} groups to projects")
            else:
                self.fail(f"Allocation failed: {result.get('message', 'Unknown error')}")
        
        except Exception as e:
            self.fail(f"Allocation algorithm failed with exception: {e}")
    
    def test_allocation_results_via_reporter(self):
        """Test getting allocation results through the reporter"""
        allocator = self.create_allocator()
        reporter = self.create_reporter()
        
        # Run allocation first
        allocator.final_allocation()
        
        try:
            results = reporter.get_allocation_results()
            
            self.assertIsInstance(results, list, "get_allocation_results should return a list")
            
            if results:
                first_result = results[0]
                required_keys = ['group_id', 'project_id', 'score', 'allocation_type']
                for key in required_keys:
                    self.assertIn(key, first_result, f"Result should contain '{key}' key")
                
                # Verify score is a reasonable number
                self.assertIsInstance(first_result['score'], (int, float), "Score should be numeric")
                self.assertGreaterEqual(first_result['score'], 0, "Score should be non-negative")
                self.assertLessEqual(first_result['score'], 100, "Score should not exceed 100")
                
                print(f"Found {len(results)} allocation results")
                print(f"Sample result: Group {first_result['group_id']} -> Project {first_result['project_id']} (Score: {first_result['score']})")
            else:
                self.fail("No allocation results found")
        
        except Exception as e:
            self.fail(f"Error getting allocation results: {e}")
    
    def test_allocation_statistics(self):
        """Test allocation statistics generation"""
        allocator = self.create_allocator()
        reporter = self.create_reporter()
        
        # Run allocation first
        allocator.final_allocation()
        
        try:
            stats = reporter.get_allocation_statistics()
            
            self.assertIsInstance(stats, dict, "get_allocation_statistics should return a dict")
            self.assertIn('success', stats, "Stats should contain 'success' key")
            self.assertTrue(stats['success'], "Statistics generation should succeed")
            
            # Check summary statistics
            summary = stats['summary']
            self.assertIn('total_groups', summary)
            self.assertIn('allocated_groups', summary)
            self.assertIn('allocation_rate', summary)
            self.assertIn('average_score', summary)
            
            # Verify logical consistency
            self.assertGreaterEqual(summary['total_groups'], summary['allocated_groups'])
            self.assertGreaterEqual(summary['allocation_rate'], 0)
            self.assertLessEqual(summary['allocation_rate'], 100)
            
            print(f"Allocation rate: {summary['allocation_rate']}%")
            print(f"Average score: {summary['average_score']}")
            
        except Exception as e:
            self.fail(f"Error getting allocation statistics: {e}")
    
    def test_manager_operations(self):
        """Test manager operations for priority allocations and swapping"""
        manager = self.create_manager()
        
        try:
            # Test getting existing priorities
            priorities = manager.get_priorities()
            self.assertIsInstance(priorities, list, "get_priorities should return a list")
            initial_priority_count = len(priorities)
            print(f"Found {initial_priority_count} existing priority allocations")
            
            # Test setting a priority allocation
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get a group and project for testing
                cursor.execute("SELECT GroupID FROM groups LIMIT 1")
                group_result = cursor.fetchone()
                
                cursor.execute("SELECT ProjectID FROM projects WHERE ProjectCapacity > 0 LIMIT 1")
                project_result = cursor.fetchone()
                
                if group_result and project_result:
                    group_id = group_result[0]
                    project_id = project_result[0]
                    
                    # Set priority
                    result = manager.set_priority(group_id, project_id)
                    self.assertIsInstance(result, dict, "set_priority should return a dict")
                    self.assertIn('success', result, "Result should contain 'success' key")
                    
                    if result['success']:
                        print(f"Successfully set priority for group {group_id} to project {project_id}")
                        
                        # Verify priority was added
                        updated_priorities = manager.get_priorities()
                        self.assertEqual(len(updated_priorities), initial_priority_count + 1, 
                                       "Priority count should increase by 1")
                        
                        # Test removing priority
                        remove_result = manager.remove_priority(group_id)
                        self.assertIsInstance(remove_result, dict, "remove_priority should return a dict")
                        self.assertTrue(remove_result['success'], "Priority removal should succeed")
                        
                        # Verify priority was removed
                        final_priorities = manager.get_priorities()
                        self.assertEqual(len(final_priorities), initial_priority_count, 
                                       "Priority count should return to original")
                        
                    else:
                        print(f"Failed to set priority: {result.get('message', 'Unknown error')}")
        
        except Exception as e:
            self.fail(f"Error testing manager operations: {e}")
    
    def test_scoring_components(self):
        """Test individual scoring components"""
        allocator = self.create_allocator()
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get a sample group and project
                cursor.execute("SELECT GroupID FROM groups LIMIT 1")
                group_id = cursor.fetchone()[0]
                
                cursor.execute("SELECT ProjectID FROM projects LIMIT 1")
                project_id = cursor.fetchone()[0]
                
                # Test GPA scoring
                gpa_score = allocator.calculate_gpa_score(cursor, group_id)
                self.assertIsInstance(gpa_score, (int, float), "GPA score should be numeric")
                self.assertGreaterEqual(gpa_score, 0, "GPA score should be non-negative")
                self.assertLessEqual(gpa_score, 100, "GPA score should not exceed 100")
                
                # Test skill scoring
                skill_score = allocator.calculate_skill_score(cursor, group_id, project_id)
                self.assertIsInstance(skill_score, (int, float), "Skill score should be numeric")
                self.assertGreaterEqual(skill_score, 0, "Skill score should be non-negative")
                self.assertLessEqual(skill_score, 100, "Skill score should not exceed 100")
                
                # Test final scoring
                final_score = allocator.calculate_final_score(cursor, group_id, project_id)
                self.assertIsInstance(final_score, (int, float), "Final score should be numeric")
                self.assertGreaterEqual(final_score, 0, "Final score should be non-negative")
                
                print(f"Sample scores - GPA: {gpa_score:.2f}, Skill: {skill_score:.2f}, Final: {final_score:.2f}")
                
        except Exception as e:
            self.fail(f"Error testing scoring components: {e}")
    
    def test_export_functionality(self):
        """Test CSV export functionality through reporter"""
        allocator = self.create_allocator()
        reporter = self.create_reporter()
        
        try:
            # Run allocation first
            allocator.final_allocation()
            
            test_filename = "test_export.csv"
            result = reporter.export_to_csv(test_filename)
            
            self.assertIsInstance(result, dict, "export_to_csv should return a dict")
            self.assertIn('success', result, "Result should contain 'success' key")
            
            if result['success']:
                print(f"Export successful: {result.get('message', '')}")
                if os.path.exists(test_filename):
                    print(f"Export file {test_filename} created successfully")
                    
                    # Verify file has content using UTF-8 encoding
                    try:
                        with open(test_filename, 'r', encoding='utf-8') as f:
                            content = f.read()
                            self.assertTrue(len(content) > 0, "Export file should not be empty")
                            self.assertIn('group_id', content, "Export should contain header")
                    except UnicodeDecodeError:
                        # If UTF-8 fails, try with different encodings
                        encodings_to_try = ['utf-8-sig', 'latin1', 'cp1252']
                        content_read = False
                        for encoding in encodings_to_try:
                            try:
                                with open(test_filename, 'r', encoding=encoding) as f:
                                    content = f.read()
                                    self.assertTrue(len(content) > 0, "Export file should not be empty")
                                    content_read = True
                                    print(f"Successfully read file with {encoding} encoding")
                                    break
                            except UnicodeDecodeError:
                                continue
                        
                        if not content_read:
                            print("WARNING: Could not read export file with any standard encoding")
                    
                    # Clean up
                    try:
                        os.remove(test_filename)
                    except:
                        pass
                else:
                    self.fail("Export file was not created")
            else:
                self.fail(f"Export failed: {result.get('message', 'Unknown error')}")
        
        except Exception as e:
            self.fail(f"Error testing export: {e}")
    
    def test_capacity_constraints(self):
        """Test that project capacity constraints are respected"""
        allocator = self.create_allocator()
        
        # Run allocation
        allocator.final_allocation()
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check that no project exceeds its capacity
            cursor.execute("""
                SELECT p.ProjectID, p.ProjectName, p.ProjectCapacity, COUNT(r.GroupID) as allocated
                FROM projects p
                LEFT JOIN results r ON p.ProjectID = r.ProjectID
                GROUP BY p.ProjectID
                HAVING COUNT(r.GroupID) > p.ProjectCapacity
            """)
            
            over_capacity = cursor.fetchall()
            
            if over_capacity:
                violations = []
                for row in over_capacity:
                    violations.append(f"Project {row[0]} ({row[1]}): {row[3]} groups allocated but capacity is {row[2]}")
                self.fail(f"Capacity violations found:\n" + "\n".join(violations))
            
            print("All project capacity constraints respected")

def run_tests():
    print("=" * 60)
    print("ALLOCATION SYSTEM COMPREHENSIVE TESTS")
    print("=" * 60)
    print(f"Using database: {DB_PATH}")
    print(f"Test started at: {datetime.now()}")
    print()
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database file {DB_PATH} not found!")
        return False
    
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAllocationSystem)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped) if hasattr(result, 'skipped') else 0}")
    
    if result.wasSuccessful():
        print("\nALL TESTS PASSED!")
        status = "SUCCESS"
    else:
        print("\nSOME TESTS FAILED")
        status = "FAILED"
        
        if result.failures:
            print("\nFAILURES:")
            for test, traceback in result.failures:
                print(f"- {test}: {traceback.split('AssertionError: ')[-1].strip()}")
        
        if result.errors:
            print("\nERRORS:")
            for test, traceback in result.errors:
                error_lines = traceback.strip().split('\n')
                error_msg = error_lines[-1] if error_lines else "Unknown error"
                print(f"- {test}: {error_msg}")
    
    print(f"\nTest completed at: {datetime.now()}")
    print(f"Overall status: {status}")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)