import sqlite3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from allocation import ProjectAllocator

def test_score_functions():
    """Test the score calculation functions in the ProjectAllocator class"""
    print("Testing score calculation functions...")
    
    # Create an instance of ProjectAllocator
    allocator = ProjectAllocator()
    
    # Connect to the database
    conn = sqlite3.connect("student_project.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get a sample of groups and projects
    cursor.execute("SELECT GroupID, GroupName FROM groups LIMIT 3")
    groups = cursor.fetchall()
    
    cursor.execute("SELECT ProjectID, ProjectName FROM projects LIMIT 3")
    projects = cursor.fetchall()
    
    if not groups or not projects:
        print("Not enough data in the database for testing.")
        return
    
    print(f"Testing with {len(groups)} groups and {len(projects)} projects")
    
    # Test 1: calculate_gpa_score (GPA-based score)
    print("\n1. Testing calculate_gpa_score (GPA-based score):")
    print("-" * 70)
    for group in groups:
        group_id = group['GroupID']
        group_name = group['GroupName']
        
        # Get the GPA score
        gpa_score = allocator.calculate_gpa_score(cursor, group_id)
        print(f"Group: {group_name} (ID: {group_id})")
        print(f"  GPA-based score: {gpa_score}")
        
        # Get the grade distribution for this group to verify
        cursor.execute("""
            SELECT NumStudentsHD, NumStudentsD, NumStudentsCR, NumStudentsP
            FROM groups WHERE GroupID = ?
        """, (group_id,))
        grades = cursor.fetchone()
        if grades:
            print(f"  Grade distribution: HD: {grades['NumStudentsHD']}, D: {grades['NumStudentsD']}, CR: {grades['NumStudentsCR']}, P: {grades['NumStudentsP']}")
            total_students = (
                grades['NumStudentsHD'] + grades['NumStudentsD'] +
                grades['NumStudentsCR'] + grades['NumStudentsP']
            )
            print(f"  Total students: {total_students}")
        else:
            print("  No grade data found for this group")
        print()

    
    # Test 2: get_project_skills and get_group_skills
    print("\n2. Testing skill retrieval functions:")
    print("-" * 70)
    for project in projects:
        project_id = project['ProjectID']
        project_name = project['ProjectName']
        
        # Get project skills
        project_skills = allocator.get_project_skills(project_id)
        print(f"Project: {project_name} (ID: {project_id})")
        print(f"  Required skills: {project_skills}")
        print()
    
    for group in groups:
        group_id = group['GroupID']
        group_name = group['GroupName']
        
        # Get group skills
        group_skills = allocator.get_group_skills(group_id)
        print(f"Group: {group_name} (ID: {group_id})")
        print(f"  Group skills: {group_skills}")
        print()
    
    # Test 3: calculate_skills_score
    print("\n3. Testing calculate_skills_score:")
    print("-" * 70)
    for group in groups:
        group_id = group['GroupID']
        group_name = group['GroupName']
        
        for project in projects:
            project_id = project['ProjectID']
            project_name = project['ProjectName']
            
            # Get common skills
            common_skills_count = allocator.get_common_skills(project_id, group_id)
            project_skills = allocator.get_project_skills(project_id)
            group_skills = allocator.get_group_skills(group_id)
            
            # Calculate skills score
            skills_score = allocator.calculate_skills_score(project_id, group_id)
            
            print(f"Group: {group_name} (ID: {group_id}) and Project: {project_name} (ID: {project_id})")
            print(f"  Project required skills: {project_skills}")
            print(f"  Group skills: {group_skills}")
            print(f"  Common skills count: {common_skills_count}")
            print(f"  Skills match score: {skills_score}")
            print()
    
    # Test 4: calculate_final_score
    print("\n4. Testing calculate_final_score:")
    print("-" * 70)
    for group in groups:
        group_id = group['GroupID']
        group_name = group['GroupName']
        
        for project in projects:
            project_id = project['ProjectID']
            project_name = project['ProjectName']
            
            # Calculate individual scores
            gpa_score = allocator.calculate_match_score(cursor, group_id)
            skills_score = allocator.calculate_skills_score(project_id, group_id)
            
            # Calculate final score
            final_score = allocator.calculate_final_score(cursor, group_id, project_id)
            
            print(f"Group: {group_name} (ID: {group_id}) and Project: {project_name} (ID: {project_id})")
            print(f"  GPA-based score: {gpa_score}")
            print(f"  Skills match score: {skills_score}")
            print(f"  Final score: {final_score}")
            print()
    
    # Close the database connection
    conn.close()
    
    print("Score function testing completed!")

if __name__ == "__main__":
    test_score_functions()