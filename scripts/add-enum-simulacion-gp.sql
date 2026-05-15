-- Añade el valor del ENUM para tipo_ejercicio en PostgreSQL (tabla ejercicios).
-- Ejecutar una sola vez contra la base de datos EduPath.
-- Si el nombre del tipo ENUM difiere en tu instancia, consulta:
--   SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname;

ALTER TYPE "enum_ejercicios_tipo_ejercicio" ADD VALUE IF NOT EXISTS 'Simulación GP';
