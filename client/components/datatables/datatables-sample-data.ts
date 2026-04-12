export type DatatableEmployee = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    position: string;
    age: number;
    salary: number;
    status: 'active' | 'on_leave' | 'terminated';
    joinedAt: string;
};

export const datatableEmployees: DatatableEmployee[] = [
    { id: 1, firstName: 'Liam', lastName: 'Nguyen', email: 'liam.nguyen@example.com', department: 'Engineering', position: 'Backend developer', age: 29, salary: 92000, status: 'active', joinedAt: '2021-03-12' },
    { id: 2, firstName: 'Noah', lastName: 'Patel', email: 'noah.patel@example.com', department: 'Design', position: 'Product designer', age: 31, salary: 88000, status: 'active', joinedAt: '2020-11-02' },
    { id: 3, firstName: 'Olivia', lastName: 'Garcia', email: 'olivia.garcia@example.com', department: 'Engineering', position: 'Frontend developer', age: 27, salary: 90000, status: 'on_leave', joinedAt: '2022-01-17' },
    { id: 4, firstName: 'Emma', lastName: 'Silva', email: 'emma.silva@example.com', department: 'Sales', position: 'Account executive', age: 34, salary: 76000, status: 'active', joinedAt: '2019-07-22' },
    { id: 5, firstName: 'Ava', lastName: 'Khan', email: 'ava.khan@example.com', department: 'Marketing', position: 'Growth marketer', age: 28, salary: 72000, status: 'active', joinedAt: '2021-09-05' },
    { id: 6, firstName: 'Sophia', lastName: 'Brown', email: 'sophia.brown@example.com', department: 'HR', position: 'People partner', age: 36, salary: 81000, status: 'active', joinedAt: '2018-04-30' },
    { id: 7, firstName: 'Mia', lastName: 'Davis', email: 'mia.davis@example.com', department: 'Finance', position: 'Financial analyst', age: 30, salary: 78000, status: 'terminated', joinedAt: '2020-02-10' },
    { id: 8, firstName: 'Charlotte', lastName: 'Wilson', email: 'charlotte.wilson@example.com', department: 'Engineering', position: 'DevOps engineer', age: 33, salary: 102000, status: 'active', joinedAt: '2017-10-16' },
    { id: 9, firstName: 'Amelia', lastName: 'Martinez', email: 'amelia.martinez@example.com', department: 'Support', position: 'Support lead', age: 32, salary: 68000, status: 'active', joinedAt: '2019-12-09' },
    { id: 10, firstName: 'Harper', lastName: 'Lee', email: 'harper.lee@example.com', department: 'Engineering', position: 'QA engineer', age: 26, salary: 74000, status: 'active', joinedAt: '2022-06-01' },
    { id: 11, firstName: 'Evelyn', lastName: 'Walker', email: 'evelyn.walker@example.com', department: 'Design', position: 'UX researcher', age: 35, salary: 91000, status: 'active', joinedAt: '2016-05-18' },
    { id: 12, firstName: 'Abigail', lastName: 'Hall', email: 'abigail.hall@example.com', department: 'Sales', position: 'Sales manager', age: 38, salary: 98000, status: 'active', joinedAt: '2015-08-24' },
    { id: 13, firstName: 'Emily', lastName: 'Allen', email: 'emily.allen@example.com', department: 'Marketing', position: 'Content strategist', age: 29, salary: 70000, status: 'on_leave', joinedAt: '2021-04-14' },
    { id: 14, firstName: 'Elizabeth', lastName: 'Young', email: 'elizabeth.young@example.com', department: 'Engineering', position: 'Engineering manager', age: 40, salary: 128000, status: 'active', joinedAt: '2014-03-03' },
    { id: 15, firstName: 'Sofia', lastName: 'King', email: 'sofia.king@example.com', department: 'Finance', position: 'Controller', age: 42, salary: 115000, status: 'active', joinedAt: '2013-11-11' },
    { id: 16, firstName: 'Ella', lastName: 'Wright', email: 'ella.wright@example.com', department: 'Support', position: 'Support specialist', age: 24, salary: 52000, status: 'active', joinedAt: '2023-01-09' },
    { id: 17, firstName: 'Grace', lastName: 'Lopez', email: 'grace.lopez@example.com', department: 'HR', position: 'Recruiter', age: 27, salary: 64000, status: 'active', joinedAt: '2022-08-22' },
    { id: 18, firstName: 'Chloe', lastName: 'Hill', email: 'chloe.hill@example.com', department: 'Engineering', position: 'Mobile developer', age: 30, salary: 96000, status: 'active', joinedAt: '2020-05-27' },
    { id: 19, firstName: 'Victoria', lastName: 'Scott', email: 'victoria.scott@example.com', department: 'Sales', position: 'SDR', age: 23, salary: 54000, status: 'active', joinedAt: '2023-07-15' },
    { id: 20, firstName: 'Scarlett', lastName: 'Green', email: 'scarlett.green@example.com', department: 'Marketing', position: 'Paid media', age: 31, salary: 75000, status: 'terminated', joinedAt: '2019-09-30' },
    { id: 21, firstName: 'Aria', lastName: 'Adams', email: 'aria.adams@example.com', department: 'Engineering', position: 'Data engineer', age: 33, salary: 108000, status: 'active', joinedAt: '2018-02-19' },
    { id: 22, firstName: 'Layla', lastName: 'Baker', email: 'layla.baker@example.com', department: 'Design', position: 'Brand designer', age: 28, salary: 72000, status: 'active', joinedAt: '2021-10-10' },
    { id: 23, firstName: 'Penelope', lastName: 'Nelson', email: 'penelope.nelson@example.com', department: 'Finance', position: 'Payroll specialist', age: 37, salary: 69000, status: 'active', joinedAt: '2016-06-06' },
    { id: 24, firstName: 'Riley', lastName: 'Carter', email: 'riley.carter@example.com', department: 'Support', position: 'CX analyst', age: 26, salary: 61000, status: 'active', joinedAt: '2022-03-28' },
    { id: 25, firstName: 'Zoey', lastName: 'Mitchell', email: 'zoey.mitchell@example.com', department: 'Engineering', position: 'Security engineer', age: 35, salary: 118000, status: 'active', joinedAt: '2017-01-23' },
];
