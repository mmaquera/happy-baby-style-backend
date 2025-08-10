-- Script para verificar el esquema de autenticación optimizado
-- Este script verifica que todas las tablas y relaciones estén correctamente creadas

-- 1. Verificar tablas principales
SELECT 'Verificando tablas de autenticación...' as status;

-- Verificar estructura de user_profiles (actualizada)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- Verificar nueva tabla user_accounts
SELECT 'Tabla user_accounts:' as table_name;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_accounts' 
ORDER BY ordinal_position;

-- Verificar nueva tabla user_sessions  
SELECT 'Tabla user_sessions:' as table_name;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_sessions' 
ORDER BY ordinal_position;

-- Verificar nueva tabla user_passwords
SELECT 'Tabla user_passwords:' as table_name;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_passwords' 
ORDER BY ordinal_position;

-- 2. Verificar índices y constrains importantes
SELECT 'Verificando constrains e índices...' as status;

-- Verificar foreign keys
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('user_accounts', 'user_sessions', 'user_passwords');

-- Verificar unique constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_name IN ('user_profiles', 'user_accounts', 'user_sessions', 'user_passwords');

-- 3. Verificar enums
SELECT 'Verificando enums...' as status;

-- Verificar enum AuthProvider
SELECT enumlabel as auth_provider_values
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'AuthProvider';

-- Verificar enum UserRole
SELECT enumlabel as user_role_values  
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'UserRole';

-- 4. Contar registros existentes
SELECT 'Conteo de registros actuales...' as status;

SELECT 
    'user_profiles' as table_name,
    COUNT(*) as record_count
FROM user_profiles
UNION ALL
SELECT 
    'user_accounts' as table_name,
    COUNT(*) as record_count
FROM user_accounts
UNION ALL
SELECT 
    'user_sessions' as table_name,
    COUNT(*) as record_count
FROM user_sessions
UNION ALL
SELECT 
    'user_passwords' as table_name,
    COUNT(*) as record_count
FROM user_passwords;

-- 5. Test de integridad referencial
SELECT 'Verificando integridad referencial...' as status;

-- Verificar que no hay sesiones huérfanas
SELECT COUNT(*) as orphaned_sessions
FROM user_sessions us
LEFT JOIN user_profiles up ON us.user_id = up.id
WHERE up.id IS NULL;

-- Verificar que no hay cuentas OAuth huérfanas
SELECT COUNT(*) as orphaned_accounts
FROM user_accounts ua
LEFT JOIN user_profiles up ON ua.user_id = up.id  
WHERE up.id IS NULL;

-- Verificar que no hay passwords huérfanas
SELECT COUNT(*) as orphaned_passwords
FROM user_passwords ups
LEFT JOIN user_profiles up ON ups.user_id = up.id
WHERE up.id IS NULL;

-- 6. Consultas de ejemplo para Google Auth
SELECT 'Ejemplos de consultas para Google Auth...' as status;

-- Buscar usuario por Google provider ID (simulado)
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    ua.provider,
    ua.provider_account_id
FROM user_profiles up
JOIN user_accounts ua ON up.id = ua.user_id
WHERE ua.provider = 'google'
AND ua.provider_account_id = 'google_user_id_example'
LIMIT 1;

-- Verificar sesiones activas
SELECT 
    up.email,
    us.session_token,
    us.expires_at,
    us.is_active,
    us.user_agent
FROM user_profiles up
JOIN user_sessions us ON up.id = us.user_id
WHERE us.is_active = true
AND us.expires_at > NOW()
LIMIT 5;

SELECT 'Schema verification complete!' as status;