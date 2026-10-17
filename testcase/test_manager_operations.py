import os
import sqlite3
import tempfile
import unittest
from unittest import mock

from manager_operations import ManagerOperations

# ---------- helpers ----------

def mk_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    with sqlite3.connect(path) as conn:
        c = conn.cursor()
        # minimal schema
        c.execute("""CREATE TABLE projects(
            ProjectID TEXT PRIMARY KEY,
            ProjectName TEXT,
            ProjectCapacity INTEGER,
            UpdatedAt TEXT
        )""")
        c.execute("""CREATE TABLE groups(
            GroupID INTEGER PRIMARY KEY,
            GroupName TEXT,
            allocated_project TEXT,
            UpdatedAt TEXT
        )""")
        c.execute("""CREATE TABLE results(
            GroupID INTEGER PRIMARY KEY,
            ProjectID TEXT,
            Score REAL,
            PreferenceRank INTEGER
        )""")
        c.execute("""CREATE TABLE group_preferences(
            GroupID INTEGER,
            ProjectID TEXT,
            PreferenceNumber INTEGER,
            PRIMARY KEY(GroupID, ProjectID)
        )""")
        c.execute("""CREATE TABLE priority_allocations(
            GroupID INTEGER PRIMARY KEY,
            ProjectID TEXT,
            CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )""")
        conn.commit()
    return path

def seed(db, *, projects=(), groups=(), results=(), prefs=(), priorities=(), insert_defaults=False):
    with sqlite3.connect(db) as con:
        c = con.cursor()
        if insert_defaults:
            if not projects:
                projects = [
                    ("P1", "Proj One", 1, "2025-01-01"),
                    ("P2", "Proj Two", 2, "2025-01-01"),
                    ("P0", "Zero Cap", 0, "2025-01-01"),
                ]
            if not groups:
                groups = [
                    (1, "G1", None, "2025-01-01"),
                    (2, "G2", None, "2025-01-01"),
                    (3, "G3", None, "2025-01-01"),
                ]
            c.executemany("INSERT INTO projects(ProjectID,ProjectName,ProjectCapacity,UpdatedAt) VALUES(?,?,?,?)", projects)
            c.executemany("INSERT INTO groups(GroupID,GroupName,allocated_project,UpdatedAt) VALUES(?,?,?,?)", groups)

        if results:
            c.executemany("INSERT INTO results(GroupID,ProjectID,Score,PreferenceRank) VALUES(?,?,?,?)", results)
        if prefs:
            c.executemany("INSERT INTO group_preferences(GroupID,ProjectID,PreferenceNumber) VALUES(?,?,?)", prefs)
        if priorities:
            c.executemany("INSERT INTO priority_allocations(GroupID,ProjectID) VALUES(?,?)", priorities)
        con.commit()


# ---------- tests ----------

class TestManagerOperations(unittest.TestCase):
    def setUp(self):
        self.db = mk_db()
        # Insert default projects/groups once
        seed(self.db, insert_defaults=True)
        self.m = ManagerOperations(self.db)

    def tearDown(self):
        try:
            os.remove(self.db)
        except Exception:
            pass

    # A. set_priority
    def test_set_priority_project_not_found(self):
        r = self.m.set_priority(1, "NOPE")
        self.assertFalse(r["success"])
        self.assertIn("Project not found", r["message"])

    def test_set_priority_capacity_exceeded(self):
        # capacity(P1)=1, fill it first (priority occupation)
        seed(self.db, priorities=[(99, "P1")])
        r = self.m.set_priority(1, "P1")
        self.assertFalse(r["success"])
        self.assertIn("capacity", r["message"].lower())

    def test_set_priority_ok_and_idempotent(self):
        r1 = self.m.set_priority(1, "P2")
        self.assertTrue(r1["success"])
        r2 = self.m.set_priority(1, "P2")  # REPLACE idempotent
        self.assertTrue(r2["success"])
        # check unique by GroupID
        with sqlite3.connect(self.db) as con:
            cnt = con.execute(
                "SELECT COUNT(*) FROM priority_allocations WHERE GroupID=1 AND ProjectID='P2'"
            ).fetchone()[0]
        self.assertEqual(cnt, 1)

    def test_set_priority_zero_capacity(self):
        r = self.m.set_priority(1, "P0")
        self.assertFalse(r["success"])
        self.assertIn("capacity", r["message"].lower())

    # B. remove_priority
    def test_remove_priority_ok(self):
        seed(self.db, priorities=[(1, "P2")])
        r = self.m.remove_priority(1)
        self.assertTrue(r["success"])
        with sqlite3.connect(self.db) as con:
            cnt = con.execute(
                "SELECT COUNT(*) FROM priority_allocations WHERE GroupID=1"
            ).fetchone()[0]
        self.assertEqual(cnt, 0)

    def test_remove_priority_none(self):
        r = self.m.remove_priority(123)
        self.assertFalse(r["success"])
        self.assertIn("no priority", r["message"].lower())

    # C. get_priorities
    def test_get_priorities(self):
        seed(self.db, priorities=[(1, "P2"), (2, "P1")])
        rows = self.m.get_priorities()
        self.assertIsInstance(rows, list)
        self.assertGreaterEqual(len(rows), 2)
        # All fields present
        for row in rows:
            self.assertIn("group_id", row)
            self.assertIn("project_id", row)
            self.assertIn("group_name", row)
            self.assertIn("project_name", row)
            self.assertIn("created_at", row)

    # D. change_allocation
    def test_change_allocation_group_not_allocated(self):
        r = self.m.change_allocation(1, "P2")
        self.assertFalse(r["success"])
        self.assertIn("not currently allocated", r["message"].lower())

    def test_change_allocation_new_project_not_found(self):
        seed(self.db, results=[(1, "P1", 10.0, 1)])
        r = self.m.change_allocation(1, "NOPE")
        self.assertFalse(r["success"])
        self.assertIn("not found", r["message"].lower())

    def test_change_allocation_new_project_full(self):
        # 先把 P2 占满：capacity=2
        seed(self.db, results=[(10, "P2", 1.0, 1), (11, "P2", 1.0, 1)])
        # 目标组现在在 P1
        seed(self.db, results=[(1, "P1", 1.0, 1)])
        r = self.m.change_allocation(1, "P2")
        self.assertFalse(r["success"])
        self.assertIn("full", r["message"].lower())

    @mock.patch("allocation.ProjectAllocator")
    def test_change_allocation_success_with_pref_and_score(self, PA):
        # Group 1 currently in P1, want to switch to P2; has preference rank
        seed(self.db, results=[(1, "P1", 3.0, 2)],
                    prefs=[(1, "P2", 1)])
        # mock allocator final score
        inst = PA.return_value
        inst.calculate_final_score.return_value = 99.5

        r = self.m.change_allocation(1, "P2")
        self.assertTrue(r["success"])

        with sqlite3.connect(self.db) as con:
            cur = con.cursor()
            row = cur.execute(
                "SELECT ProjectID, Score, PreferenceRank FROM results WHERE GroupID=1"
            ).fetchone()
            self.assertEqual(row[0], "P2")
            self.assertAlmostEqual(row[1], 99.5, places=3)
            self.assertEqual(row[2], 1)

            # Note: current implementation updates groups.allocated_project to ProjectID
            g = cur.execute(
                "SELECT allocated_project FROM groups WHERE GroupID=1"
            ).fetchone()[0]
            self.assertEqual(g, "P2")  # If you change to store ProjectName, update assertion here

    # E. swap_groups
    def test_swap_groups_need_both_allocated(self):
        seed(self.db, results=[(1, "P1", 1.0, 1)])  # Only one group
        r = self.m.swap_groups(1, 2)
        self.assertFalse(r["success"])
        self.assertIn("both groups", r["message"].lower())

    @mock.patch("allocation.ProjectAllocator")  # ✅ Correct patch target
    def test_swap_groups_success(self, PA):
        # 1 in P1, 2 in P2, swap
        seed(self.db, results=[(1, "P1", 10.0, 1), (2, "P2", 20.0, 1)],
                    prefs=[(1, "P2", 1), (2, "P1", 2)])
        inst = PA.return_value
        inst.calculate_final_score.side_effect = [88.8, 77.7]  # 1->P2, 2->P1

        r = self.m.swap_groups(1, 2)
        self.assertTrue(r["success"])

        with sqlite3.connect(self.db) as con:
            cur = con.cursor()
            r1 = cur.execute(
                "SELECT ProjectID, Score, PreferenceRank FROM results WHERE GroupID=1"
            ).fetchone()
            r2 = cur.execute(
                "SELECT ProjectID, Score, PreferenceRank FROM results WHERE GroupID=2"
            ).fetchone()
            self.assertEqual(r1[0], "P2"); self.assertAlmostEqual(r1[1], 88.8, places=2); self.assertEqual(r1[2], 1)
            self.assertEqual(r2[0], "P1"); self.assertAlmostEqual(r2[1], 77.7, places=2); self.assertEqual(r2[2], 2)
            g1 = cur.execute("SELECT allocated_project FROM groups WHERE GroupID=1").fetchone()[0]
            g2 = cur.execute("SELECT allocated_project FROM groups WHERE GroupID=2").fetchone()[0]
            self.assertEqual(g1, "P2")
            self.assertEqual(g2, "P1")

    # F. get_group_allocation
    def test_get_group_allocation_when_exists(self):
        seed(self.db, results=[(1, "P1", 12.3, 2)])
        r = self.m.get_group_allocation(1)
        self.assertTrue(r["success"])
        self.assertEqual(r["data"]["project_id"], "P1")
        self.assertEqual(r["data"]["project_name"], "Proj One")
        self.assertAlmostEqual(r["data"]["score"], 12.3, places=2)
        self.assertEqual(r["data"]["preference_rank"], 2)

    def test_get_group_allocation_when_missing(self):
        r = self.m.get_group_allocation(42)
        self.assertFalse(r["success"])
        self.assertIn("not allocated", r["message"].lower())

if __name__ == "__main__":
    unittest.main(verbosity=2)
