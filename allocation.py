import sqlite3
import json
import re
import pandas as pd
import yaml
from description_matcher import get_description_score

class ProjectAllocator:
    def __init__(self, db_path="student_project.db"):
        self.db_path = db_path
        # Read weights from config.yml in the same directory
        try:
            import os
            config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.yml')
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                self.SKILL_WEIGHT = config.get('skillWeight', 0.4)
                self.SCORE_WEIGHT = config.get('scoreWeight', 0.4)
                self.DESCRIPTION_WEIGHT = config.get('descriptionWeight', 0.2)
        except Exception as e:
            print(f"Warning: Could not load weights from config.yml: {e}")
            # Use default values
            self.SKILL_WEIGHT = 0.4
            self.SCORE_WEIGHT = 0.4
            self.DESCRIPTION_WEIGHT = 0.2

    def calculate_gpa_score(self, cursor, group_id):
        group_grades = cursor.execute('''
            SELECT NumStudentsHD, NumStudentsD, NumStudentsCR, NumStudentsP
            FROM groups WHERE GroupID = ?
        ''', (group_id,)).fetchone()
        
        if not group_grades:
            return 0
        
        num_hd, num_d, num_cr, num_p = group_grades
        
        grade_points = {
            'HD': 100,
            'D': 75,
            'CR': 50,
            'P': 25,
        }
        
        total_points = (
            num_hd * grade_points['HD'] +
            num_d * grade_points['D'] +
            num_cr * grade_points['CR'] +
            num_p * grade_points['P']
        )
        
        total_students = num_hd + num_d + num_cr + num_p
        
        if total_students == 0:
            return 0
            
        return total_points / total_students
    

    def calculate_skill_score(self, cursor, group_id, project_id):
        """
        Compute skill match score in [0,100] using projects.Tags (JSON array).
        - Each tag may contain multiple sub-skills split by / , ; or newlines.
        - Group skills come from (group_skills JOIN skills).
        """
        #Read project Tags (JSON array text)
        row = cursor.execute("SELECT Tags FROM projects WHERE ProjectID = ?", (project_id,)).fetchone()

        #If no tags provided, treat as no requirements. This means full score.
        if not row or row[0] is None or str(row[0]).strip() == "":
            return 100.0

        #Parse tags JSON into required_skills (lowercased)
        required_skills = set()
        try:
            tags_json = row[0]
            if isinstance(tags_json, str):
                tags_list = json.loads(tags_json)
            else:
                tags_list = tags_json

            if not isinstance(tags_list, list):
                tags_list = [str(tags_json)]
        except (json.JSONDecodeError, TypeError, ValueError):
            tags_list = [str(row[0])]

        splitter = re.compile(r'[/,;\n]+')
        for tag in tags_list:
            if not tag:
                continue
            for skill in splitter.split(str(tag).strip()):
                skill = skill.strip().lower()
                if skill:
                    required_skills.add(skill)

        #If no parsed required skills, give full score
        if not required_skills:
            return 100.0

        #Read group skills
        cursor.execute("""
            SELECT s.SkillName
            FROM group_skills gs
            JOIN skills s ON gs.SkillID = s.SkillID
            WHERE gs.GroupID = ?
        """, (group_id,))
        group_skills = set()
        for (skill_name,) in cursor.fetchall():
            if not skill_name:
                continue
            for skill in re.split(r'[/,;\n()]+', skill_name.strip()):
                skill = skill.strip().lower()
                if skill:
                    group_skills.add(skill)

        common = len(required_skills & group_skills)
        return (common / len(required_skills)) * 100.0
    

    def calculate_final_score(self, cursor, group_id, project_id):
        gpa = self.calculate_gpa_score(cursor, group_id)
        skill = self.calculate_skill_score(cursor, group_id, project_id)
        description = get_description_score(self.db_path, group_id, project_id, self.DESCRIPTION_WEIGHT)
        return gpa * self.SCORE_WEIGHT + skill * self.SKILL_WEIGHT + description * self.DESCRIPTION_WEIGHT
    

    def get_project_popularity(self, cursor):
        cursor.execute("""
            SELECT ProjectID, COUNT(*) as preference_count
            FROM group_preferences
            GROUP BY ProjectID
            ORDER BY preference_count DESC
        """)
        return dict(cursor.fetchall())


    def gale_shapley_allocation(self, cursor):
        # Get all unallocated groups
        cursor.execute("""
            SELECT GroupID 
            FROM groups 
            WHERE allocated_project IS NULL
        """)
        all_groups = [row[0] for row in cursor.fetchall()]
        
        # Get priority allocations for unallocated groups
        cursor.execute("""
            SELECT pa.GroupID, pa.ProjectID 
            FROM priority_allocations pa
            JOIN groups g ON pa.GroupID = g.GroupID
            WHERE g.allocated_project IS NULL
        """)
        priority_allocs = cursor.fetchall()
        
        # Check for manual allocations for unallocated groups
        cursor.execute("""
            SELECT r.GroupID, r.ProjectID 
            FROM results r
            WHERE r.Score IS NULL 
            AND r.PreferenceRank IS NULL
        """)
        manual_allocs = cursor.fetchall()
        
        # Exclude both priority and manual allocated groups from free groups
        priority_group_ids = {row[0] for row in priority_allocs}
        manual_group_ids = {row[0] for row in manual_allocs}
        excluded_group_ids = priority_group_ids | manual_group_ids
        free_groups_list = [g for g in all_groups if g not in excluded_group_ids]
        
        # Get project capacities and current allocations
        cursor.execute("""
            SELECT 
                p.ProjectID, 
                p.ProjectCapacity,
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT DISTINCT GroupID 
                        FROM results 
                        WHERE ProjectID = p.ProjectID
                        UNION
                        SELECT GroupID 
                        FROM groups 
                        WHERE allocated_project = p.ProjectName
                    )
                ) as current_allocated
            FROM projects p
        """)
        projects_data = cursor.fetchall()
        project_capacity = {p[0]: p[1] for p in projects_data}
        project_current_allocated = {p[0]: p[2] for p in projects_data}
        
        project_popularity = self.get_project_popularity(cursor)
        
        # Initialize with priority and manual allocations
        free_groups = set(free_groups_list)
        group_next_preference = {g: 1 for g in free_groups_list}
        project_current_matches = {p[0]: [] for p in projects_data}
        
        # Add priority allocations to project matches and update capacity
        for group_id, project_id in priority_allocs:
            if project_id in project_current_matches:
                project_current_matches[project_id].append(group_id)
                project_current_allocated[project_id] += 1
        
        # Note: Manual allocations are already reflected in project_current_allocated
        # from the initial capacity calculation, so we don't need to add them again
        
        max_preferences = 5
        
        # Main Gale-Shapley loop
        while free_groups:
            proposals = []
            
            for group_id in list(free_groups):
                pref_rank = group_next_preference[group_id]
                
                if pref_rank > max_preferences:
                    free_groups.discard(group_id)
                    continue
                
                cursor.execute("""
                    SELECT p.ProjectID as project_id
                    FROM group_preferences gp
                    INNER JOIN projects p ON UPPER(gp.ProjectID) = UPPER(p.ProjectID)
                    WHERE gp.GroupID = ? AND gp.PreferenceNumber = ?
                """, (group_id, pref_rank))
                
                result = cursor.fetchone()
                if result:
                    project_id = result[0]
                    # Check if project has remaining capacity
                    if project_current_allocated[project_id] < project_capacity[project_id]:
                        proposals.append((group_id, project_id))
                
                group_next_preference[group_id] += 1
            
            # Only break if no groups have any more preferences to try
            if not proposals:
                # Check if any groups still have preferences to try
                groups_with_preferences = any(
                    group_next_preference[g] <= max_preferences for g in free_groups
                )
                if not groups_with_preferences:
                    break
            
            for group_id, project_id in proposals:
                current_matches = project_current_matches[project_id]
                total_capacity = project_capacity[project_id]
                current_allocated = project_current_allocated[project_id]
                
                # Calculate how many groups can be accepted (total capacity)
                max_allocations = total_capacity
                all_candidates = current_matches + [group_id]
                
                candidate_scores = []
                for candidate_id in all_candidates:
                    base_score = self.calculate_final_score(cursor, candidate_id, project_id)
                    popularity = project_popularity.get(project_id, 0)
                    popularity_penalty = min(5, popularity * 0.5)
                    adjusted_score = base_score - popularity_penalty
                    candidate_scores.append((candidate_id, adjusted_score))
                
                candidate_scores.sort(key=lambda x: x[1], reverse=True)
                accepted_groups = [g[0] for g in candidate_scores[:max_allocations]]
                rejected_groups = [g[0] for g in candidate_scores[max_allocations:]]
                
                project_current_matches[project_id] = accepted_groups
                
                # Update capacity counts
                project_current_allocated[project_id] = len(accepted_groups)
                
                for accepted_group in accepted_groups:
                    free_groups.discard(accepted_group)
                
                for rejected_group in rejected_groups:
                    if rejected_group == group_id:
                        free_groups.add(rejected_group)
        
        # Convert to group allocation format (only automatic allocations)
        group_allocation = {}
        for project_id, matched_groups in project_current_matches.items():
            for group_id in matched_groups:
                # Only include groups that are not manually allocated
                if group_id not in manual_group_ids:
                    group_allocation[group_id] = project_id
        
        return group_allocation


    def allocate_remaining_groups(self, group_allocation, cursor):
        # Get all unallocated groups
        cursor.execute("""
            SELECT GroupID 
            FROM groups 
            WHERE allocated_project IS NULL
        """)
        all_groups = [row[0] for row in cursor.fetchall()]
        
        # Get manually allocated groups (both Score and PreferenceRank are NULL)
        cursor.execute("""
            SELECT r.GroupID 
            FROM results r
            JOIN groups g ON r.GroupID = g.GroupID
            WHERE r.Score IS NULL 
            AND r.PreferenceRank IS NULL
            AND g.allocated_project IS NULL
        """)
        manual_allocated_groups = {row[0] for row in cursor.fetchall()}
    
        # Combine automatic and manual allocations
        allocated_groups = set(group_allocation.keys()) | manual_allocated_groups
        unallocated_groups = [g for g in all_groups if g not in allocated_groups]
    
        if not unallocated_groups:
            return group_allocation
    
        # Count all allocations including manual ones and existing allocations
        cursor.execute("""
            SELECT 
                p.ProjectID, 
                p.ProjectCapacity,
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT DISTINCT GroupID 
                        FROM results 
                        WHERE ProjectID = p.ProjectID
                        UNION
                        SELECT GroupID 
                        FROM groups 
                        WHERE allocated_project = p.ProjectName
                    )
                ) as allocated_count
            FROM projects p
            WHERE p.ProjectCapacity > (
                SELECT COUNT(*) 
                FROM (
                    SELECT DISTINCT GroupID 
                    FROM results 
                    WHERE ProjectID = p.ProjectID
                    UNION
                    SELECT GroupID 
                    FROM groups 
                    WHERE allocated_project = p.ProjectName
                )
            )
            ORDER BY (
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT DISTINCT GroupID 
                        FROM results 
                        WHERE ProjectID = p.ProjectID
                        UNION
                        SELECT GroupID 
                        FROM groups 
                        WHERE allocated_project = p.ProjectName
                    )
                ) * 1.0 / p.ProjectCapacity
            ) ASC
        """)
    
        available_projects = []
        for row in cursor.fetchall():
            project_id, capacity, allocated = row
            remaining_capacity = capacity - allocated
            available_projects.append((project_id, remaining_capacity))
    
        if not available_projects:
            return group_allocation
    
        # Return existing allocation directly, let save_result handle unallocated groups
        # save_result has more comprehensive logic:
        # 1. Try allocation in preference order
        # 2. Automatically try next preference
        # 3. Finally try all possible allocations
        return group_allocation


    def save_result(self, group_allocation, cursor):
        # First get existing allocations from groups table
        cursor.execute("""
            SELECT g.GroupID, g.allocated_project, p.ProjectID
            FROM groups g
            JOIN projects p ON g.allocated_project = p.ProjectName
            WHERE g.allocated_project IS NOT NULL
        """)
        existing_allocations = {row[0]: {"project_name": row[1], "project_id": row[2]} for row in cursor.fetchall()}
        
        # Get project capacities and count existing allocations
        cursor.execute("""
            SELECT 
                p.ProjectID, 
                p.ProjectName,
                p.ProjectCapacity,
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT DISTINCT GroupID 
                        FROM results 
                        WHERE ProjectID = p.ProjectID
                        UNION
                        SELECT GroupID 
                        FROM groups 
                        WHERE allocated_project = p.ProjectName
                    )
                ) as current_allocated
            FROM projects p
        """)
        project_info = {row[0]: {"name": row[1], "capacity": row[2], "allocated": row[3]} 
                       for row in cursor.fetchall()}

        # Delete only automatic allocation results (where Score or PreferenceRank is NOT NULL)
        cursor.execute("DELETE FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL")
        
        # Filter out groups that already have allocations from the input
        group_allocation = {k: v for k, v in group_allocation.items() if k not in existing_allocations}
        
        # Get all groups' preferences
        cursor.execute("""
            SELECT gp.GroupID, p.ProjectID as project_id, gp.PreferenceNumber 
            FROM group_preferences gp
            INNER JOIN projects p ON UPPER(gp.ProjectID) = UPPER(p.ProjectID)
            ORDER BY gp.GroupID, gp.PreferenceNumber
        """)
        group_preferences = {}
        for row in cursor.fetchall():
            group_id, project_id, pref_num = row
            if group_id not in group_preferences:
                group_preferences[group_id] = []
            group_preferences[group_id].append(project_id)

        # Sort allocations by score and preference rank
        scored_allocations = []
        for group_id, project_id in group_allocation.items():
            score = self.calculate_final_score(cursor, group_id, project_id)
            pref_rank = None
            try:
                pref_rank = group_preferences[group_id].index(project_id) + 1
            except (KeyError, ValueError):
                pass
            scored_allocations.append((group_id, project_id, score, pref_rank))
        
        # Sort by score in descending order
        scored_allocations.sort(key=lambda x: (x[3] if x[3] is not None else float('inf'), -x[2]))
        
        # Process allocations with retry
        unallocated_groups = set()
        for group_id, project_id, score, pref_rank in scored_allocations:
            # If project is full, try next preference
            if project_info[project_id]["allocated"] >= project_info[project_id]["capacity"]:
                if group_id in group_preferences:
                    current_pref_idx = group_preferences[group_id].index(project_id) if project_id in group_preferences[group_id] else -1
                    # Try next preferences
                    for next_project_id in group_preferences[group_id][current_pref_idx + 1:]:
                        if project_info[next_project_id]["allocated"] < project_info[next_project_id]["capacity"]:
                            project_id = next_project_id
                            score = self.calculate_final_score(cursor, group_id, project_id)
                            pref_rank = group_preferences[group_id].index(project_id) + 1
                            break
                    else:
                        unallocated_groups.add(group_id)
                        continue
                else:
                    unallocated_groups.add(group_id)
                    continue
                
            # Get preference rank
            cursor.execute("""
                SELECT gp.PreferenceNumber 
                FROM group_preferences gp
                INNER JOIN projects p ON UPPER(gp.ProjectID) = UPPER(p.ProjectID)
                WHERE gp.GroupID = ? AND p.ProjectID = ?
            """, (group_id, project_id))
            
            pref_result = cursor.fetchone()
            pref_rank = pref_result[0] if pref_result else None
            
            # Check if it's a priority allocation
            cursor.execute("""
                SELECT 1 FROM priority_allocations 
                WHERE GroupID = ? AND ProjectID = ?
            """, (group_id, project_id))
            
            if cursor.fetchone():
                pref_rank = 0  # 0 indicates priority allocation
            
            # Insert into results table
            cursor.execute("""
                INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank)
                VALUES (?, ?, ?, ?)
            """, (group_id, project_id, score, pref_rank))
            
            # Update allocated_project in groups table
            cursor.execute("""
                UPDATE groups 
                SET allocated_project = ?
                WHERE GroupID = ?
            """, (project_info[project_id]["name"], group_id))
            
            # Update allocation count
            project_info[project_id]["allocated"] += 1
        
        # Try to allocate any unallocated groups to their next available preferences
        while unallocated_groups:
            newly_allocated = set()
            for group_id in unallocated_groups:
                if group_id in group_preferences:
                    # Try each preference in order
                    for project_id in group_preferences[group_id]:
                        if project_info[project_id]["allocated"] < project_info[project_id]["capacity"]:
                            score = self.calculate_final_score(cursor, group_id, project_id)
                            # Get preference rank using the corrected query
                            cursor.execute("""
                                SELECT gp.PreferenceNumber 
                                FROM group_preferences gp
                                INNER JOIN projects p ON UPPER(gp.ProjectID) = UPPER(p.ProjectID)
                                WHERE gp.GroupID = ? AND p.ProjectID = ?
                            """, (group_id, project_id))
                            pref_result = cursor.fetchone()
                            pref_rank = pref_result[0] if pref_result else None
                            
                            # Insert into results table
                            cursor.execute("""
                                INSERT INTO results (GroupID, ProjectID, Score, PreferenceRank)
                                VALUES (?, ?, ?, ?)
                            """, (group_id, project_id, score, pref_rank))
                            
                            # Update allocated_project in groups table
                            cursor.execute("""
                                UPDATE groups 
                                SET allocated_project = ?
                                WHERE GroupID = ?
                            """, (project_info[project_id]["name"], group_id))
                            
                            # Update allocation count
                            project_info[project_id]["allocated"] += 1
                            newly_allocated.add(group_id)
                            break
            
            # If no new allocations were made in this round, break
            if not newly_allocated:
                break
            unallocated_groups -= newly_allocated
        
        cursor.connection.commit()


    def final_allocation(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get existing allocations that should be preserved
                cursor.execute("""
                    SELECT g.GroupID, g.allocated_project, p.ProjectID
                    FROM groups g
                    JOIN projects p ON g.allocated_project = p.ProjectName
                    WHERE g.allocated_project IS NOT NULL
                """)
                existing_allocations = {row[0]: {"project_name": row[1], "project_id": row[2]} 
                                      for row in cursor.fetchall()}

                # Clear only automatic allocations
                cursor.execute('DELETE FROM results WHERE Score IS NOT NULL OR PreferenceRank IS NOT NULL')
                cursor.execute('UPDATE groups SET allocated_project = NULL WHERE GroupID NOT IN (SELECT GroupID FROM results)')
                conn.commit()
                
                # Get total groups count
                total_groups = cursor.execute('SELECT COUNT(*) FROM groups').fetchone()[0]
                
                # Run Gale-Shapley (this already excludes manual allocations)
                group_allocation = self.gale_shapley_allocation(cursor)
                
                # Allocate remaining groups (this also excludes manual allocations)
                group_allocation = self.allocate_remaining_groups(group_allocation, cursor)
                
                # Save all results at once (this preserves manual allocations)
                self.save_result(group_allocation, cursor)

                # Compute pool scores for still-unallocated groups (ProjectID stays NULL)
                # Does NOT affect capacity or allocations; strictly for UI display.

                # groups with no allocated_project and no results row
                cursor.execute("""
                    SELECT g.GroupID
                    FROM groups g
                    WHERE g.allocated_project IS NULL
                    AND NOT EXISTS (SELECT 1 FROM results r WHERE r.GroupID = g.GroupID)
                """)
                pool_groups = [row[0] for row in cursor.fetchall()]

                if pool_groups:
                    # Build availability map: exclude full projects (considering both results and groups.allocated_project)
                    cursor.execute(
                        """
                        SELECT 
                            p.ProjectID, 
                            p.ProjectCapacity,
                            (
                                SELECT COUNT(*) 
                                FROM (
                                    SELECT DISTINCT GroupID FROM results WHERE ProjectID = p.ProjectID
                                    UNION
                                    SELECT GroupID FROM groups WHERE allocated_project = p.ProjectName
                                )
                            ) as allocated_count
                        FROM projects p
                        """
                    )
                    availability_rows = cursor.fetchall()
                    remaining_by_project = {row[0]: max(0, (row[1] or 0) - (row[2] or 0)) for row in availability_rows}

                    # evaluate best score across eligible projects (not in preferences, not full) for each pool group
                    for group_id in pool_groups:
                        # collect this group's preferences
                        cursor.execute(
                            """
                            SELECT p.ProjectID 
                            FROM group_preferences gp
                            INNER JOIN projects p ON UPPER(gp.ProjectID) = UPPER(p.ProjectID)
                            WHERE gp.GroupID = ?
                            ORDER BY gp.PreferenceNumber
                            """,
                            (group_id,)
                        )
                        prefs = {r[0] for r in cursor.fetchall()}

                        best_score = None
                        best_project_id = None
                        for project_id, remaining in remaining_by_project.items():
                            if remaining <= 0:
                                continue  # skip full projects
                            if project_id in prefs:
                                continue  # skip group's own preferences (sub-option only)
                            score = self.calculate_final_score(cursor, group_id, project_id)
                            if best_score is None or score > best_score:
                                best_score = score
                                best_project_id = project_id

                        if best_score is not None and best_project_id is not None:
                            # Persist pool suggestion: keep ProjectID NULL, write Score and SubOptionProjectID
                            try:
                                cursor.execute(
                                    "INSERT INTO results (GroupID, Score, SubOptionProjectID) VALUES (?, ?, ?)",
                                    (group_id, best_score, str(best_project_id)),
                                )
                            except sqlite3.OperationalError:
                                # Fallback if SubOptionProjectID column does not exist
                                cursor.execute(
                                    "INSERT INTO results (GroupID, Score) VALUES (?, ?)",
                                    (group_id, best_score),
                                )
                
                # Count allocated and unallocated groups
                allocated_count = cursor.execute(
                    'SELECT COUNT(*) FROM groups WHERE allocated_project IS NOT NULL'
                ).fetchone()[0]
                
                unallocated_count = cursor.execute(
                    'SELECT COUNT(*) FROM groups WHERE allocated_project IS NULL'
                ).fetchone()[0]
                
                return {
                    'success': True,
                    'message': 'Allocation completed successfully',
                    'totalGroups': total_groups,
                    'allocatedGroups': allocated_count,
                    'unallocatedGroups': unallocated_count,
                    'executionTime': 0  # Will be calculated by backend
                }
                
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }
