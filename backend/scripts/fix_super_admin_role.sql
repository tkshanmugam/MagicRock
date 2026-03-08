-- Fix "User is not assigned to any organization"
--
-- Option 1: Super admin (admin) - role was NULL after migrations
-- Replace 'admin' with your SUPER_ADMIN_USERNAME from .env if different.
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE username = 'admin' AND (role IS NULL OR role != 'SUPER_ADMIN');

-- Option 2: Regular user - assign to an organization (run after creating org if needed)
-- Replace USER_ID, ORG_ID, ROLE_ID with actual IDs from your database.
-- INSERT INTO user_organizations (user_id, organization_id, role_id, status)
-- VALUES (USER_ID, ORG_ID, ROLE_ID, 'active');
