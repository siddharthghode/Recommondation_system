-- ==============================================================================
-- Automated PostgreSQL Database Initialization
-- Runs on first startup when PostgreSQL data volume is initialized
-- ==============================================================================

\echo '*** Initializing University Library Management Database: library_recommondation ***'

-- Create common extensions if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\echo '*** Database extensions initialized successfully ***'
