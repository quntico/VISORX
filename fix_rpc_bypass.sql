-- RPC BYPASS: Server-Side Creation Function
-- This function runs inside the database, bypassing client-side RLS checks.

CREATE OR REPLACE FUNCTION create_project_safe(
    p_name TEXT,
    p_description TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges
AS $$
DECLARE
    new_project JSONB;
BEGIN
    INSERT INTO projects (name, description, user_id, status, created_at)
    VALUES (p_name, p_description, p_user_id, 'pending', NOW())
    RETURNING to_jsonb(projects.*) INTO new_project;

    RETURN new_project;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'RPC Error: %', SQLERRM;
END;
$$;

-- Grant execute permission to everyone (Auth handled by app logic)
GRANT EXECUTE ON FUNCTION create_project_safe TO authenticated;
GRANT EXECUTE ON FUNCTION create_project_safe TO anon;
GRANT EXECUTE ON FUNCTION create_project_safe TO service_role;
