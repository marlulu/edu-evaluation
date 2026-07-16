# Permission Test Accounts

Use these accounts to verify authentication, role visibility, module permissions,
course collaboration, and student course isolation.

| Username | Password | Role | Test purpose |
| --- | --- | --- | --- |
| `admin` | `admin123` | Administrator | Manage system configuration and teacher/assistant module permissions. |
| `teacher01` | `teacher123` | Teacher | Create courses, manage students and groups, and create course tasks. |
| `assistant01` | `assistant123` | Assistant | Verify course collaboration and module permission restrictions after being added to a course. |
| `student01` | `student123` | Student | Verify login and student-only navigation visibility. |
| `teacher_view` | `Teacher@123` | Teacher | Grant only `VIEW` for course, student, and task modules. Verify creation and editing are denied. |
| `teacher_editor` | `Teacher@123` | Teacher | Grant `VIEW`, `CREATE`, and `EDIT`, but not `DELETE`. Verify the default teacher permission shape. |
| `assistant_limited` | `Assist@123` | Assistant | Grant task `VIEW` only. Add to one course and verify access is limited to that course. |
| `student_course_a` | `Student@123` | Student | Join course A and verify only course A tasks can be viewed and submitted. |
| `student_course_b` | `Student@123` | Student | Join course B and verify cross-course reads and submissions are denied. |

## Required Setup

- Create `teacher_view`, `teacher_editor`, and `assistant_limited` through the
  registration or assistant creation flow before using them.
- Configure each teacher or assistant's module actions from the administrator
  account.
- Add `assistant_limited` only to the target course before checking course
  scope restrictions.
- Import `student_course_a` and `student_course_b` in student management,
  then complete student registration with their one-time initial passwords.
- Add each student to the intended course member snapshot before creating
  course tasks.

## Current Seed Account Limitation

The current `student01` seed account is not bound to a `studentId`. It can
verify login and navigation, but cannot verify personal task listing or
submission isolation. Use the two registered course students for those flows.
