-- Marcar un usuario como admin por correo
-- Uso: ajusta el email y ejecuta en la base de datos del proyecto

UPDATE users SET is_admin = 1 WHERE email = 'TU_CORREO_AQUI';
