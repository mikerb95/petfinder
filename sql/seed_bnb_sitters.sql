-- Seed de 10 cuidadores en Bogotá con ubicación, horarios, tipos admitidos, costos y servicios adicionales
INSERT INTO bnb_sitters (user_id, name, bio, city, lat, lng, address, pet_types, hours_json, services, price_cents, currency, experience_years, photo_url, rating, reviews_count, active)
VALUES
(
	NULL,'Huellitas Chapinero','Cuidado en casa con paseos 2 veces al día.','Bogotá',4.653332,-74.062877,'Cra 13 # 58-30, Chapinero',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00","weekend":"09:00-18:00"}',
	'boarding,daycare,walking,bath,feeding',70000,'COP',3,'https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=800',4.8,36,1
),
(
	NULL,'Patitas Usaquén','Amplio jardín y área de juego, reportes diarios.','Bogotá',4.706240,-74.031297,'Calle 122 # 7-45, Usaquén',
	'perros_pequenos,perros_medianos,gatos', '{"daily":"08:00-20:00","weekend":"09:00-18:00"}',
	'boarding,daycare,walking,bath,feeding,vetdrive',85000,'COP',5,'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',4.9,58,1
),
(
	NULL,'Guardería Parque 93','Zona segura cerca al parque, atención 24/7.','Bogotá',4.676732,-74.048808,'Cra 13a # 93-45, Chicó',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00"}',
	'boarding,daycare,walking,feeding',90000,'COP',4,'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800',4.7,41,1
),
(
	NULL,'Dog Lovers Teusaquillo','Ambiente familiar, máximo 3 huéspedes.','Bogotá',4.639386,-74.078503,'Calle 45 # 19-10, Teusaquillo',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00"}',
	'boarding,daycare,walking,bath,feeding,training',65000,'COP',6,'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=800',4.6,28,1
),
(
	NULL,'Happy Tails Suba','Casa con terraza, monitoreo por cámara.','Bogotá',4.744917,-74.083652,'Av Suba # 116-20, Suba',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00"}',
	'boarding,daycare,walking,bath,feeding',60000,'COP',3,'https://images.unsplash.com/photo-1507149833265-60c372daea22?w=800',4.5,22,1
),
(
	NULL,'Peludos Cedritos','Paseos al parque y socialización guiada.','Bogotá',4.721321,-74.033031,'Calle 140 # 11-30, Cedritos',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00"}',
	'daycare,walking,bath,feeding',50000,'COP',2,'https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?w=800',4.4,17,1
),
(
	NULL,'Cat&Dog Salitre','Espacio apto para gatos y perros pequeños.','Bogotá',4.659549,-74.106003,'Av 68 # 24-20, Salitre',
	'perros_pequenos,gatos', '{"daily":"08:00-19:00"}',
	'boarding,daycare,feeding,bath',70000,'COP',4,'https://images.unsplash.com/photo-1558944351-c3ad7c8a29f0?w=800',4.7,33,1
),
(
	NULL,'Pet Home Kennedy','Recogida a domicilio, atención amorosa.','Bogotá',4.621011,-74.154274,'Calle 26 Sur # 78-15, Kennedy',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00"}',
	'boarding,daycare,walking,feeding,vetdrive',55000,'COP',3,'https://images.unsplash.com/photo-1548588627-f978862b85e9?w=800',4.3,19,1
),
(
	NULL,'Canis Norte','Adiestrador certificado, planes de entrenamiento.','Bogotá',4.685357,-74.058481,'Calle 100 # 15-20, Chicó Norte',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-21:00"}',
	'boarding,training,walking,daycare,feeding',95000,'COP',7,'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800',4.9,64,1
),
(
	NULL,'Mi Mejor Amigo Bosa','Casa amplia, patio cubierto, seguimiento por WhatsApp.','Bogotá',4.609710,-74.191010,'Calle 65 Sur # 80-12, Bosa',
	'perros_pequenos,perros_medianos', '{"daily":"08:00-19:00","sunday":"10:00-16:00"}',
	'daycare,walking,feeding,bath',45000,'COP',2,'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=800',4.2,12,1
);

-- Nota: Los horarios básicos están en hours_json (JSON simple) y tipos admitidos en pet_types (CSV).
