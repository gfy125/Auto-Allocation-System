import sqlite3
import json
from datetime import datetime


class AllocationDashboard:
    def __init__(self, db_path="student_project.db"):
        self.db_path = db_path

    
    def get_overview_statistics(self):
        """
        Get overview statistics
        Returns total groups, allocation rate, average score, etc.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='results'")
                if not cursor.fetchone():
                    return {
                        'success': False,
                        'message': 'No allocation results found. Please run allocation first.',
                        'data': None
                    }
                
                # Total groups
                cursor.execute("SELECT COUNT(*) FROM groups")
                total_groups = cursor.fetchone()[0]
                
                # Total projects
                cursor.execute("SELECT COUNT(*) FROM projects")
                total_projects = cursor.fetchone()[0]
                
                # Allocated groups
                cursor.execute("SELECT COUNT(*) FROM results")
                allocated_groups = cursor.fetchone()[0]
                
                # Average score
                cursor.execute("SELECT AVG(Score) FROM results")
                avg_score = cursor.fetchone()[0] or 0
                
                # Total capacity
                cursor.execute("SELECT SUM(ProjectCapacity) FROM projects")
                total_capacity = cursor.fetchone()[0] or 0
                
                return {
                    'success': True,
                    'data': {
                        'total_groups': total_groups,
                        'total_projects': total_projects,
                        'allocated_groups': allocated_groups,
                        'unallocated_groups': total_groups - allocated_groups,
                        'allocation_rate': round((allocated_groups / total_groups * 100), 2) if total_groups > 0 else 0,
                        'average_score': round(avg_score, 2),
                        'total_capacity': total_capacity,
                        'used_capacity': allocated_groups,
                        'capacity_utilization': round((allocated_groups / total_capacity * 100), 2) if total_capacity > 0 else 0
                    }
                }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': None}


    def get_preference_distribution(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT COUNT(*) FROM results")
                total = cursor.fetchone()[0]
                
                if total == 0:
                    return {'success': False, 'message': 'No allocation results found', 'data': None}
                
                cursor.execute("""
                    SELECT PreferenceRank, COUNT(*) as count
                    FROM results
                    GROUP BY PreferenceRank
                """)
                
                pref_map = {
                    0: ('Priority Allocation', 'priority'),
                    1: ('1st Preference', 'first'),
                    2: ('2nd Preference', 'second'),
                    3: ('3rd Preference', 'third'),
                    4: ('4th Preference', 'fourth'),
                    5: ('5th Preference', 'fifth'),
                    None: ('Score-based Match', 'score_based')
                }
                
                distribution = {}
                chart_data = []
                
                for rank, count in cursor.fetchall():
                    name, key = pref_map.get(rank, ('Unknown', 'unknown'))
                    percentage = round((count / total * 100), 2) if total > 0 else 0
                    
                    distribution[key] = {
                        'count': count,
                        'percentage': percentage
                    }
                    
                    chart_data.append({
                        'name': name,
                        'value': count,
                        'percentage': percentage
                    })
                
                return {
                    'success': True,
                    'data': {
                        'distribution': distribution,
                        'chart_data': chart_data,
                        'total_allocated': total
                    }
                }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': None}
    

    def get_allocation_results(self, group_id=None, project_id=None, sort_by='score', order='desc', limit=None):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT 
                        r.GroupID,
                        g.GroupName,
                        r.ProjectID,
                        p.ProjectName,
                        p.ProjectClient,
                        r.Score,
                        r.PreferenceRank
                    FROM results r
                    LEFT JOIN groups g ON r.GroupID = g.GroupID
                    LEFT JOIN projects p ON r.ProjectID = p.ProjectID
                    WHERE 1=1
                """
                params = []
                
                if group_id:
                    query += " AND r.GroupID = ?"
                    params.append(group_id)
                if project_id:
                    query += " AND r.ProjectID = ?"
                    params.append(project_id)
                
                # Sorting
                sort_map = {
                    'score': 'r.Score',
                    'group_id': 'r.GroupID',
                    'preference_rank': 'r.PreferenceRank'
                }
                sort_column = sort_map.get(sort_by, 'r.Score')
                query += f" ORDER BY {sort_column} {order.upper()}"
                
                if limit:
                    query += f" LIMIT {limit}"
                
                cursor.execute(query, params)
                
                pref_text_map = {
                    0: 'Priority',
                    1: '1st Choice',
                    2: '2nd Choice',
                    3: '3rd Choice',
                    4: '4th Choice',
                    5: '5th Choice',
                    None: 'Score-based'
                }
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        'group_id': row[0],
                        'group_name': row[1] or f"Group {row[0]}",
                        'project_id': row[2],
                        'project_name': row[3] or "Unknown Project",
                        'client': row[4] or "Unknown Client",
                        'score': round(row[5], 2) if row[5] else 0,
                        'preference_rank': row[6],
                        'allocation_type': pref_text_map.get(row[6], 'Score-based')
                    })
                
                return {
                    'success': True,
                    'data': results,
                    'count': len(results)
                }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': []}


    def get_allocation_by_group(self, group_id):
        result = self.get_allocation_results(group_id=group_id)
        if result['success'] and result['data']:
            return {'success': True, 'data': result['data'][0]}
        return {'success': False, 'message': 'Group not allocated', 'data': None}


    def get_allocation_by_project(self, project_id):
        return self.get_allocation_results(project_id=project_id)

    
    def get_project_statistics(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        p.ProjectID,
                        p.ProjectName,
                        p.ProjectClient,
                        p.ProjectCapacity,
                        COUNT(r.GroupID) as allocated,
                        AVG(r.Score) as avg_score
                    FROM projects p
                    LEFT JOIN results r ON p.ProjectID = r.ProjectID
                    GROUP BY p.ProjectID
                """)
                
                projects = []
                for row in cursor.fetchall():
                    project_id = row[0]
                    capacity = row[3]
                    allocated = row[4]
                    
                    # Get preference breakdown for this project
                    cursor.execute("""
                        SELECT PreferenceRank, COUNT(*) 
                        FROM results 
                        WHERE ProjectID = ?
                        GROUP BY PreferenceRank
                    """, (project_id,))
                    
                    pref_breakdown = {}
                    for pref_rank, count in cursor.fetchall():
                        if pref_rank == 0:
                            pref_breakdown['priority'] = count
                        elif pref_rank is not None:
                            pref_breakdown[f'pref_{pref_rank}'] = count
                        else:
                            pref_breakdown['score_based'] = count
                    
                    projects.append({
                        'project_id': project_id,
                        'project_name': row[1],
                        'client': row[2] or "Unknown",
                        'capacity': capacity,
                        'allocated': allocated,
                        'remaining': capacity - allocated,
                        'utilization': round((allocated / capacity * 100), 2) if capacity > 0 else 0,
                        'average_score': round(row[5], 2) if row[5] else 0,
                        'preference_breakdown': pref_breakdown,
                        'status': 'full' if allocated >= capacity else 'available'
                    })
                
                return {'success': True, 'data': projects}
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': []}
    

    def get_project_utilization_chart(self):
        result = self.get_project_statistics()
        if not result['success']:
            return result
        
        projects = result['data']
        return {
            'success': True,
            'data': {
                'labels': [p['project_id'] for p in projects],
                'utilization': [p['utilization'] for p in projects],
                'allocated': [p['allocated'] for p in projects],
                'capacity': [p['capacity'] for p in projects]
            }
        }

    
    def get_unallocated_groups(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        g.GroupID,
                        g.GroupName,
                        g.NumStudentsHD,
                        g.NumStudentsD,
                        g.NumStudentsCR,
                        g.NumStudentsP
                    FROM groups g
                    LEFT JOIN results r ON g.GroupID = r.GroupID
                    WHERE r.GroupID IS NULL
                """)
                
                unallocated = []
                for row in cursor.fetchall():
                    group_id = row[0]
                    
                    # Get preferences for this group
                    cursor.execute("""
                        SELECT gp.PreferenceNumber, gp.ProjectID, p.ProjectName
                        FROM group_preferences gp
                        LEFT JOIN projects p ON gp.ProjectID = p.ProjectID
                        WHERE gp.GroupID = ?
                        ORDER BY gp.PreferenceNumber
                    """, (group_id,))
                    
                    preferences = []
                    for pref_row in cursor.fetchall():
                        preferences.append({
                            'rank': pref_row[0],
                            'project_id': pref_row[1],
                            'project_name': pref_row[2]
                        })
                    
                    total_students = row[2] + row[3] + row[4] + row[5]
                    
                    unallocated.append({
                        'group_id': group_id,
                        'group_name': row[1] or f"Group {group_id}",
                        'member_count': total_students,
                        'gpa_info': {
                            'hd': row[2],
                            'd': row[3],
                            'cr': row[4],
                            'p': row[5]
                        },
                        'preferences': preferences
                    })
                
                return {'success': True, 'data': unallocated, 'count': len(unallocated)}
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': []}
    

    def get_remaining_matches(self):
        try:
            from allocation import ProjectAllocator
            allocator = ProjectAllocator(self.db_path)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get unallocated groups
                cursor.execute("""
                    SELECT g.GroupID
                    FROM groups g
                    LEFT JOIN results r ON g.GroupID = r.GroupID
                    WHERE r.GroupID IS NULL
                    ORDER BY g.GroupID
                """)
                remaining_groups = [row[0] for row in cursor.fetchall()]
                
                # Get available projects (with remaining capacity)
                cursor.execute("""
                    SELECT 
                        p.ProjectID,
                        p.ProjectCapacity - COALESCE(COUNT(r.GroupID), 0) AS remaining_capacity
                    FROM projects p
                    LEFT JOIN results r ON p.ProjectID = r.ProjectID
                    GROUP BY p.ProjectID, p.ProjectCapacity
                    HAVING (p.ProjectCapacity - COALESCE(COUNT(r.GroupID), 0)) > 0
                    ORDER BY remaining_capacity DESC, p.ProjectID
                """)
                available_projects = [row[0] for row in cursor.fetchall()]
                
                # Calculate matching scores
                result_dict = {}
                for group_id in remaining_groups:
                    project_scores = {}
                    for project_id in available_projects:
                        # Use allocator's calculate_final_score method
                        score = allocator.calculate_final_score(cursor, group_id, project_id)
                        project_scores[project_id] = round(score, 2)
                    
                    result_dict[group_id] = project_scores
                
                return {'success': True, 'data': result_dict}
        except ImportError:
            return {'success': False, 'message': 'ProjectAllocator not available', 'data': {}}
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': {}}

    
    def get_quality_metrics(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Preference satisfaction (top 3 preferences)
                cursor.execute("""
                    SELECT 
                        COUNT(CASE WHEN PreferenceRank <= 3 THEN 1 END) * 100.0 / COUNT(*)
                    FROM results
                    WHERE PreferenceRank IS NOT NULL
                """)
                pref_satisfaction = cursor.fetchone()[0] or 0
                
                # Average preference rank (excluding priority)
                cursor.execute("""
                    SELECT AVG(PreferenceRank)
                    FROM results
                    WHERE PreferenceRank IS NOT NULL AND PreferenceRank > 0
                """)
                avg_pref_rank = cursor.fetchone()[0] or 0
                
                # Score statistics
                cursor.execute("""
                    SELECT 
                        MIN(Score) as min_score,
                        MAX(Score) as max_score,
                        AVG(Score) as avg_score,
                        COUNT(CASE WHEN Score >= 70 THEN 1 END) * 100.0 / COUNT(*) as high_score_rate,
                        COUNT(CASE WHEN Score >= 60 AND Score < 70 THEN 1 END) * 100.0 / COUNT(*) as medium_score_rate,
                        COUNT(CASE WHEN Score < 60 THEN 1 END) * 100.0 / COUNT(*) as low_score_rate
                    FROM results
                """)
                score_stats = cursor.fetchone()
                
                # Best matches (top 10)
                cursor.execute("""
                    SELECT r.GroupID, g.GroupName, r.ProjectID, p.ProjectName, r.Score
                    FROM results r
                    LEFT JOIN groups g ON r.GroupID = g.GroupID
                    LEFT JOIN projects p ON r.ProjectID = p.ProjectID
                    ORDER BY r.Score DESC
                    LIMIT 10
                """)
                top_matches = [
                    {
                        'group_id': row[0],
                        'group_name': row[1],
                        'project_id': row[2],
                        'project_name': row[3],
                        'score': round(row[4], 2)
                    }
                    for row in cursor.fetchall()
                ]
                
                # Worst matches (bottom 10)
                cursor.execute("""
                    SELECT r.GroupID, g.GroupName, r.ProjectID, p.ProjectName, r.Score
                    FROM results r
                    LEFT JOIN groups g ON r.GroupID = g.GroupID
                    LEFT JOIN projects p ON r.ProjectID = p.ProjectID
                    ORDER BY r.Score ASC
                    LIMIT 10
                """)
                low_matches = [
                    {
                        'group_id': row[0],
                        'group_name': row[1],
                        'project_id': row[2],
                        'project_name': row[3],
                        'score': round(row[4], 2)
                    }
                    for row in cursor.fetchall()
                ]
                
                return {
                    'success': True,
                    'data': {
                        'preference_satisfaction_rate': round(pref_satisfaction, 2),
                        'average_preference_rank': round(avg_pref_rank, 2),
                        'score_statistics': {
                            'min': round(score_stats[0], 2) if score_stats[0] else 0,
                            'max': round(score_stats[1], 2) if score_stats[1] else 0,
                            'average': round(score_stats[2], 2) if score_stats[2] else 0,
                            'high_score_percentage': round(score_stats[3], 2) if score_stats[3] else 0,
                            'medium_score_percentage': round(score_stats[4], 2) if score_stats[4] else 0,
                            'low_score_percentage': round(score_stats[5], 2) if score_stats[5] else 0
                        },
                        'top_matches': top_matches,
                        'low_matches': low_matches
                    }
                }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': None}

    
    def get_score_distribution(self, bin_size=10):
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT Score FROM results ORDER BY Score DESC")
                scores = [row[0] for row in cursor.fetchall()]
                
                if not scores:
                    return {'success': False, 'message': 'No scores found', 'data': None}
                
                # Create score bins
                min_score = int(min(scores) // bin_size * bin_size)
                max_score = int(max(scores) // bin_size * bin_size + bin_size)
                
                bins = list(range(min_score, max_score + bin_size, bin_size))
                counts = [0] * (len(bins) - 1)
                
                for score in scores:
                    for i in range(len(bins) - 1):
                        if bins[i] <= score < bins[i + 1]:
                            counts[i] += 1
                            break
                
                return {
                    'success': True,
                    'data': {
                        'bins': [f"{bins[i]}-{bins[i+1]}" for i in range(len(bins)-1)],
                        'counts': counts,
                        'raw_scores': scores[:50]  # Return only top 50 scores
                    }
                }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': None}
    

    def get_full_dashboard_data(self):
        try:
            return {
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'data': {
                    'overview': self.get_overview_statistics(),
                    'preference_distribution': self.get_preference_distribution(),
                    'allocation_results': self.get_allocation_results(limit=100),
                    'project_statistics': self.get_project_statistics(),
                    'unallocated_groups': self.get_unallocated_groups(),
                    'quality_metrics': self.get_quality_metrics(),
                    'score_distribution': self.get_score_distribution(),
                    'project_utilization': self.get_project_utilization_chart()
                }
            }
        except Exception as e:
            return {'success': False, 'message': str(e), 'data': None}

    
    def export_dashboard_json(self, filename="dashboard_data.json"):
        try:
            data = self.get_full_dashboard_data()
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return {'success': True, 'message': f'Data exported to {filename}'}
        except Exception as e:
            return {'success': False, 'message': str(e)}





def print_dashboard_summary():
    dashboard = AllocationDashboard()
    
    print("=" * 60)
    print("ALLOCATION DASHBOARD")
    print("=" * 60)
    
    # Overview
    overview = dashboard.get_overview_statistics()
    if overview['success']:
        data = overview['data']
        print(f"\n=== OVERVIEW ===")
        print(f"Total Groups: {data['total_groups']}")
        print(f"Allocated Groups: {data['allocated_groups']}")
        print(f"Allocation Rate: {data['allocation_rate']}%")
        print(f"Average Score: {data['average_score']}")
    else:
        print(f"\nError: {overview['message']}")
        return
    
    # Preference distribution
    pref_dist = dashboard.get_preference_distribution()
    if pref_dist['success']:
        print(f"\n=== PREFERENCE DISTRIBUTION ===")
        for item in pref_dist['data']['chart_data']:
            print(f"{item['name']}: {item['value']} ({item['percentage']}%)")
    
    # Unallocated groups
    unallocated = dashboard.get_unallocated_groups()
    if unallocated['success']:
        print(f"\n=== UNALLOCATED GROUPS ===")
        print(f"Count: {unallocated['count']}")
        if unallocated['data']:
            for group in unallocated['data'][:5]:  # Show only first 5
                print(f"  Group {group['group_id']}: {group['group_name']}")
    
    # Quality metrics
    quality = dashboard.get_quality_metrics()
    if quality['success']:
        data = quality['data']
        print(f"\n=== QUALITY METRICS ===")
        print(f"Preference Satisfaction: {data['preference_satisfaction_rate']}%")
        print(f"Average Preference Rank: {data['average_preference_rank']}")
        stats = data['score_statistics']
        print(f"Score Range: {stats['min']:.2f} - {stats['max']:.2f}")
        print(f"High Score (≥70): {stats['high_score_percentage']:.1f}%")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    print_dashboard_summary()
    
    # Export full data
    dashboard = AllocationDashboard()
    result = dashboard.export_dashboard_json()
    if result['success']:
        print(f"\n{result['message']}")