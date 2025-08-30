-- 10 publicaciones de ejemplo para clasificados
-- Nota: Ajusta los user_id existentes en tu base de datos si es necesario.
INSERT INTO classifieds (user_id, title, category, condition, description, price_cents, currency, city, photo_url, status)
VALUES
  (1, 'Rascador para gato mediano', 'Accesorios', 'buen_estado', 'Rascador de sisal en buen estado, poco uso.', 80000, 'COP', 'Bogotá', 'https://images.unsplash.com/photo-1612536052698-7b9c4780a4f2?q=80&w=800&auto=format&fit=crop', 'active'),
  (1, 'Cama acolchada para perro', 'Accesorios', 'como_nuevo', 'Cama talla M lavable, casi nueva.', 120000, 'COP', 'Bogotá', 'https://images.unsplash.com/photo-1626132647523-66f78f001387?q=80&w=800&auto=format&fit=crop', 'active'),
  (2, 'Juguete mordedor de cuerda', 'Juguetes', 'nuevo', 'Mordedor resistente para perros medianos.', 30000, 'COP', 'Medellín', 'https://images.unsplash.com/photo-1568572933382-74d440642117?q=80&w=800&auto=format&fit=crop', 'active'),
  (2, 'Transportadora plástica', 'Transporte', 'buen_estado', 'Transportadora tamaño pequeño con ventilación.', 95000, 'COP', 'Medellín', 'https://images.unsplash.com/photo-1624760132512-131b8987cdf3?q=80&w=800&auto=format&fit=crop', 'active'),
  (3, 'Arnés para gato con correa', 'Accesorios', 'usado', 'Arnés ajustable con correa, usado pero funcional.', 25000, 'COP', 'Cali', 'https://images.unsplash.com/photo-1601758124060-9d1e6ee5ff56?q=80&w=800&auto=format&fit=crop', 'active'),
  (3, 'Plato doble de acero', 'Accesorios', 'como_nuevo', 'Plato doble antideslizante de acero inoxidable.', 40000, 'COP', 'Cali', 'https://images.unsplash.com/photo-1601758174210-b5b06288b434?q=80&w=800&auto=format&fit=crop', 'active'),
  (4, 'Ropa impermeable talla S', 'Ropa', 'buen_estado', 'Chaqueta impermeable para perro pequeño.', 60000, 'COP', 'Barranquilla', 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=800&auto=format&fit=crop', 'active'),
  (4, 'Cortaúñas para mascotas', 'Higiene', 'nuevo', 'Cortaúñas profesional con tope de seguridad.', 28000, 'COP', 'Barranquilla', 'https://images.unsplash.com/photo-1620325867502-221cfb5faa5f?q=80&w=800&auto=format&fit=crop', 'active'),
  (5, 'Comedero automático', 'Accesorios', 'buen_estado', 'Dispensador de comida con temporizador.', 180000, 'COP', 'Bucaramanga', 'https://images.unsplash.com/photo-1625246333195-78e8f0e4b1e0?q=80&w=800&auto=format&fit=crop', 'active'),
  (5, 'Higiénico para gatos con pala', 'Higiene', 'como_nuevo', 'Caja de arena con cubierta, apenas usada.', 70000, 'COP', 'Bucaramanga', 'https://images.unsplash.com/photo-1612264325624-29d641cd4d08?q=80&w=800&auto=format&fit=crop', 'active');
