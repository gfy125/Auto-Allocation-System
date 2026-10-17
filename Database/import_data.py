from database import create_groups_table
from database import create_projects_table
from database import create_result_table
from database import create_user_table
from import_group_info import insert_data_from_excel
from import_project_info import insert_projects_from_docx
from import_project_info import update_project_capacity_from_excel


if __name__ == "__main__":
    create_groups_table()
    create_projects_table()
    create_result_table()
    create_user_table()

    insert_data_from_excel()

    insert_projects_from_docx()
    update_project_capacity_from_excel()
