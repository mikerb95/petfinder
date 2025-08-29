-- Demo products for Petfinder shop
INSERT INTO products (name, slug, sku, price_cents, currency, stock, active, image_url, description)
VALUES
	('Collar QR — Azul', 'collar-qr-azul', 'COL-QR-AZUL', 49900, 'COP', 50, 1, NULL, 'Collar para perro con placa QR en color azul.'),
	('Collar QR — Rosa', 'collar-qr-rosa', 'COL-QR-ROSA', 49900, 'COP', 40, 1, NULL, 'Collar para perro con placa QR en color rosa.'),
	('Placa QR — Acero', 'placa-qr-acero', 'PLA-QR-ACERO', 29900, 'COP', 100, 1, NULL, 'Placa de identificación con QR en acero inoxidable.'),
	('Tag NFC — Llavero', 'tag-nfc-llavero', 'TAG-NFC-LLA', 39900, 'COP', 60, 1, NULL, 'Tag NFC en formato llavero para lectura rápida.'),
	('Kit QR + NFC', 'kit-qr-nfc', 'KIT-QR-NFC', 79900, 'COP', 30, 1, NULL, 'Kit combinado de placa QR y tag NFC.');

