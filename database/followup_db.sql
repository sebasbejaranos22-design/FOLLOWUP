SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS followup_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE followup_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_rastreo;
DROP VIEW IF EXISTS v_resumen_estados;
DROP PROCEDURE IF EXISTS sp_cambiar_estado;

DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS historial_estados;
DROP TABLE IF EXISTS ubicaciones;
DROP TABLE IF EXISTS seguimientos;
DROP TABLE IF EXISTS paquetes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS estados;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE estados (
  id_estado     INT NOT NULL AUTO_INCREMENT,
  nombre_estado VARCHAR(50) NOT NULL,
  descripcion   VARCHAR(150),
  es_final      TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_estado),
  UNIQUE KEY uq_estados_nombre (nombre_estado)
);

CREATE TABLE empresas (
  id_empresa     INT NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100) NOT NULL,
  direccion      VARCHAR(150),
  telefono       VARCHAR(20),
  email          VARCHAR(100) NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa),
  UNIQUE KEY uq_empresas_email (email)
);

CREATE TABLE clientes (
  id_cliente     INT NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100) NOT NULL,
  telefono       VARCHAR(20),
  email          VARCHAR(100) NOT NULL,
  direccion      VARCHAR(150),
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  UNIQUE KEY uq_clientes_email (email)
);

CREATE TABLE usuarios (
  id_usuario        INT NOT NULL AUTO_INCREMENT,
  nombre            VARCHAR(100) NOT NULL,
  email             VARCHAR(100) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  rol               ENUM('admin','empresa','cliente') NOT NULL DEFAULT 'cliente',
  id_empresa        INT NULL,
  id_cliente        INT NULL,
  activo            TINYINT(1) NOT NULL DEFAULT 1,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME NULL,
  ultimo_login      DATETIME NULL,
  fecha_creacion    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_email (email),
  CONSTRAINT fk_usuarios_empresa FOREIGN KEY (id_empresa) REFERENCES empresas (id_empresa),
  CONSTRAINT fk_usuarios_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT chk_usuarios_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_usuarios_rol CHECK (
    rol = 'admin'
    OR (rol = 'empresa' AND id_empresa IS NOT NULL)
    OR (rol = 'cliente' AND id_cliente IS NOT NULL)
  )
);

CREATE TABLE paquetes (
  id_paquete          INT NOT NULL AUTO_INCREMENT,
  numero_serie        VARCHAR(50) NOT NULL,
  descripcion         VARCHAR(200),
  id_empresa          INT NOT NULL,
  id_cliente          INT NOT NULL,
  id_estado           INT NOT NULL DEFAULT 1,
  fecha_envio         DATE NOT NULL,
  fecha_entrega       DATETIME NULL,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_paquete),
  UNIQUE KEY uq_paquetes_serie (numero_serie),
  CONSTRAINT fk_paquetes_empresa FOREIGN KEY (id_empresa) REFERENCES empresas (id_empresa),
  CONSTRAINT fk_paquetes_cliente FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT fk_paquetes_estado  FOREIGN KEY (id_estado)  REFERENCES estados (id_estado),
  CONSTRAINT chk_paquetes_serie CHECK (numero_serie REGEXP '^[A-Za-z0-9-]{4,50}$'),
  CONSTRAINT chk_paquetes_fechas CHECK (fecha_entrega IS NULL OR fecha_entrega >= fecha_envio)
);

CREATE TABLE seguimientos (
  id_seguimiento INT NOT NULL AUTO_INCREMENT,
  id_paquete     INT NOT NULL,
  id_usuario     INT NOT NULL,
  comentario     TEXT NOT NULL,
  fecha          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_seguimiento),
  KEY idx_seguimientos_paquete_fecha (id_paquete, fecha),
  KEY idx_seguimientos_usuario (id_usuario),
  CONSTRAINT fk_seguimientos_paquete FOREIGN KEY (id_paquete) REFERENCES paquetes (id_paquete),
  CONSTRAINT fk_seguimientos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
);

CREATE TABLE ubicaciones (
  id_ubicacion INT NOT NULL AUTO_INCREMENT,
  id_paquete   INT NOT NULL,
  latitud      DECIMAL(10,8) NOT NULL,
  longitud     DECIMAL(11,8) NOT NULL,
  fecha        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_ubicacion),
  KEY idx_ubicaciones_paquete_fecha (id_paquete, fecha),
  CONSTRAINT fk_ubicaciones_paquete FOREIGN KEY (id_paquete) REFERENCES paquetes (id_paquete),
  CONSTRAINT chk_ubicaciones_lat CHECK (latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_ubicaciones_lon CHECK (longitud BETWEEN -180 AND 180)
);

CREATE TABLE historial_estados (
  id_historial   INT NOT NULL AUTO_INCREMENT,
  id_paquete     INT NOT NULL,
  id_estado      INT NOT NULL,
  comentario     VARCHAR(200),
  registrado_por VARCHAR(100),
  fecha          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  KEY idx_historial_paquete_fecha (id_paquete, fecha),
  KEY idx_historial_estado (id_estado),
  CONSTRAINT fk_historial_paquete FOREIGN KEY (id_paquete) REFERENCES paquetes (id_paquete),
  CONSTRAINT fk_historial_estado  FOREIGN KEY (id_estado)  REFERENCES estados (id_estado)
);

CREATE TABLE auditoria (
  id          INT NOT NULL AUTO_INCREMENT,
  usuario     VARCHAR(100),
  accion      VARCHAR(50) NOT NULL,
  tabla       VARCHAR(50),
  id_registro INT NULL,
  detalle     TEXT,
  fecha       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auditoria_fecha (fecha)
);

CREATE OR REPLACE VIEW v_rastreo AS
SELECT
  p.id_paquete,
  p.numero_serie,
  p.descripcion,
  p.id_empresa,
  e.nombre         AS empresa,
  p.id_cliente,
  c.nombre         AS cliente,
  es.id_estado,
  es.nombre_estado AS estado,
  es.es_final,
  p.fecha_envio,
  p.fecha_entrega,
  u.latitud        AS ultima_latitud,
  u.longitud       AS ultima_longitud,
  u.fecha          AS fecha_ultima_ubicacion
FROM paquetes p
JOIN empresas e  ON e.id_empresa = p.id_empresa
JOIN clientes c  ON c.id_cliente = p.id_cliente
JOIN estados es  ON es.id_estado = p.id_estado
LEFT JOIN ubicaciones u ON u.id_ubicacion = (
  SELECT u2.id_ubicacion
  FROM ubicaciones u2
  WHERE u2.id_paquete = p.id_paquete
  ORDER BY u2.fecha DESC, u2.id_ubicacion DESC
  LIMIT 1
);

CREATE OR REPLACE VIEW v_resumen_estados AS
SELECT es.nombre_estado AS estado, COUNT(p.id_paquete) AS total
FROM estados es
LEFT JOIN paquetes p ON p.id_estado = es.id_estado
GROUP BY es.id_estado, es.nombre_estado;

DELIMITER //

CREATE TRIGGER trg_paquetes_ai
AFTER INSERT ON paquetes
FOR EACH ROW
BEGIN
  INSERT INTO historial_estados (id_paquete, id_estado, comentario, registrado_por)
  VALUES (NEW.id_paquete, NEW.id_estado, 'Paquete registrado', COALESCE(@usuario_app, USER()));

  INSERT INTO auditoria (usuario, accion, tabla, id_registro, detalle)
  VALUES (COALESCE(@usuario_app, USER()), 'INSERT', 'paquetes', NEW.id_paquete,
          CONCAT('Paquete ', NEW.numero_serie, ' creado'));
END //

CREATE TRIGGER trg_paquetes_bu
BEFORE UPDATE ON paquetes
FOR EACH ROW
BEGIN
  DECLARE v_final TINYINT DEFAULT 0;
  DECLARE v_nuevo VARCHAR(50) DEFAULT NULL;

  IF NOT (NEW.id_estado <=> OLD.id_estado) THEN
    SELECT es_final INTO v_final FROM estados WHERE id_estado = OLD.id_estado;
    IF v_final = 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El paquete ya está cerrado, no se puede cambiar su estado';
    END IF;

    SELECT nombre_estado INTO v_nuevo FROM estados WHERE id_estado = NEW.id_estado;
    IF v_nuevo = 'Entregado' AND NEW.fecha_entrega IS NULL THEN
      SET NEW.fecha_entrega = NOW();
    END IF;
  END IF;
END //

CREATE TRIGGER trg_paquetes_au
AFTER UPDATE ON paquetes
FOR EACH ROW
BEGIN
  IF NOT (NEW.id_estado <=> OLD.id_estado) THEN
    INSERT INTO historial_estados (id_paquete, id_estado, comentario, registrado_por)
    VALUES (NEW.id_paquete, NEW.id_estado,
            COALESCE(@comentario_estado, 'Cambio automático de estado'),
            COALESCE(@usuario_app, USER()));
  END IF;

  INSERT INTO auditoria (usuario, accion, tabla, id_registro, detalle)
  VALUES (COALESCE(@usuario_app, USER()), 'UPDATE', 'paquetes', NEW.id_paquete,
          IF(NEW.id_estado <=> OLD.id_estado,
             CONCAT('Paquete ', NEW.numero_serie, ': se actualizaron datos'),
             CONCAT('Paquete ', NEW.numero_serie, ': ',
                    (SELECT nombre_estado FROM estados WHERE id_estado = OLD.id_estado), ' -> ',
                    (SELECT nombre_estado FROM estados WHERE id_estado = NEW.id_estado))));
END //

CREATE TRIGGER trg_paquetes_bd
BEFORE DELETE ON paquetes
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Los paquetes no se borran, cámbiales el estado';
END //

CREATE TRIGGER trg_auditoria_bu
BEFORE UPDATE ON auditoria
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoría no se puede modificar';
END //

CREATE TRIGGER trg_auditoria_bd
BEFORE DELETE ON auditoria
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoría no se puede borrar';
END //

CREATE PROCEDURE sp_cambiar_estado(
  IN p_guia       VARCHAR(50),
  IN p_id_estado  INT,
  IN p_comentario VARCHAR(200),
  IN p_usuario    VARCHAR(100),
  IN p_latitud    DECIMAL(10,8),
  IN p_longitud   DECIMAL(11,8)
)
BEGIN
  DECLARE v_id INT DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @usuario_app = NULL;
    SET @comentario_estado = NULL;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT id_paquete INTO v_id FROM paquetes WHERE numero_serie = p_guia FOR UPDATE;
  IF v_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El paquete no existe';
  END IF;

  SET @usuario_app = p_usuario;
  SET @comentario_estado = p_comentario;

  UPDATE paquetes SET id_estado = p_id_estado WHERE id_paquete = v_id;

  IF p_latitud IS NOT NULL AND p_longitud IS NOT NULL THEN
    INSERT INTO ubicaciones (id_paquete, latitud, longitud)
    VALUES (v_id, p_latitud, p_longitud);
  END IF;

  SET @usuario_app = NULL;
  SET @comentario_estado = NULL;

  COMMIT;
END //

DELIMITER ;

INSERT INTO estados (id_estado, nombre_estado, descripcion, es_final) VALUES
(1, 'Pendiente',   'El paquete fue registrado y espera despacho', 0),
(2, 'En tránsito', 'El paquete va en camino al destinatario',     0),
(3, 'Entregado',   'El destinatario ya recibió el paquete',       1),
(4, 'Novedad',     'Hubo un problema con la entrega',             0),
(5, 'Cancelado',   'El envío fue cancelado',                      1);

INSERT INTO empresas (nombre, direccion, telefono, email) VALUES
('Envios Express', 'Bogotá',   '3001112233', 'contacto@envios.com'),
('Logistica Pro',  'Medellín', '3012223344', 'info@logistica.com');

INSERT INTO clientes (nombre, telefono, email, direccion) VALUES
('Juan Perez',      '3001234567', 'juan@mail.com',   'Calle 100 # 15-20, Bogotá'),
('Maria Rodriguez', '3019876543', 'maria@mail.com',  'Carrera 43A # 1-50, Medellín'),
('Andres Lopez',    '3024567890', 'andres@mail.com', 'Avenida 68 # 22-10, Bogotá'),
('Camila Torres',   '3036547891', 'camila@mail.com', 'Calle 10 # 5-30, Cali'),
('Luis Martinez',   '3049871234', 'luis@mail.com',   'Carrera 7 # 72-41, Bogotá');

INSERT INTO usuarios (nombre, email, password_hash, rol, id_empresa, id_cliente) VALUES
('Sebastian Bejarano', 'sebastian@mail.com', '$2b$10$.zW2AIudq6lhQNVll8U3XenlRpG0FLyD0/3Cw74AH0fWqB.qOLlL.', 'admin',   NULL, NULL),
('Laura Gomez',        'laura@mail.com',     '$2b$10$.zW2AIudq6lhQNVll8U3XenlRpG0FLyD0/3Cw74AH0fWqB.qOLlL.', 'empresa', 1,    NULL),
('Carlos Perez',       'carlos@mail.com',    '$2b$10$.zW2AIudq6lhQNVll8U3XenlRpG0FLyD0/3Cw74AH0fWqB.qOLlL.', 'empresa', 2,    NULL),
('Juan Perez',         'juan@mail.com',      '$2b$10$.zW2AIudq6lhQNVll8U3XenlRpG0FLyD0/3Cw74AH0fWqB.qOLlL.', 'cliente', NULL, 1),
('Maria Rodriguez',    'maria@mail.com',     '$2b$10$.zW2AIudq6lhQNVll8U3XenlRpG0FLyD0/3Cw74AH0fWqB.qOLlL.', 'cliente', NULL, 2);

INSERT INTO paquetes (numero_serie, descripcion, id_empresa, id_cliente, fecha_envio) VALUES
('PKG001', 'Caja con repuestos de moto',  1, 1, '2026-04-10'),
('PKG002', 'Documentos legales',          2, 2, '2026-04-11'),
('PKG003', 'Teclado mecánico',            1, 1, '2026-04-12'),
('PKG004', 'Paquete de ropa',             2, 3, '2026-04-14');

SET @usuario_app = 'laura@mail.com';
SET @comentario_estado = 'En camino a destino';
UPDATE paquetes SET id_estado = 2 WHERE numero_serie = 'PKG001';

SET @usuario_app = 'carlos@mail.com';
SET @comentario_estado = 'Salió de la bodega de Medellín';
UPDATE paquetes SET id_estado = 2 WHERE numero_serie = 'PKG002';
SET @comentario_estado = 'Entregado al destinatario';
UPDATE paquetes SET id_estado = 3 WHERE numero_serie = 'PKG002';
SET @comentario_estado = 'Dirección no encontrada, se reintenta mañana';
UPDATE paquetes SET id_estado = 4 WHERE numero_serie = 'PKG004';

SET @usuario_app = NULL;
SET @comentario_estado = NULL;

UPDATE historial_estados SET fecha = '2026-04-10 08:00:00' WHERE id_historial = 1;
UPDATE historial_estados SET fecha = '2026-04-11 09:00:00' WHERE id_historial = 2;
UPDATE historial_estados SET fecha = '2026-04-12 10:00:00' WHERE id_historial = 3;
UPDATE historial_estados SET fecha = '2026-04-14 11:00:00' WHERE id_historial = 4;
UPDATE historial_estados SET fecha = '2026-04-10 14:00:00' WHERE id_historial = 5;
UPDATE historial_estados SET fecha = '2026-04-12 07:30:00' WHERE id_historial = 6;
UPDATE historial_estados SET fecha = '2026-04-13 15:30:00' WHERE id_historial = 7;
UPDATE historial_estados SET fecha = '2026-04-15 16:20:00' WHERE id_historial = 8;
UPDATE paquetes SET fecha_entrega = '2026-04-13 15:30:00' WHERE numero_serie = 'PKG002';

INSERT INTO seguimientos (id_paquete, id_usuario, comentario, fecha) VALUES
(1, 2, 'Paquete recibido en bodega',                     '2026-04-10 08:10:00'),
(1, 2, 'En camino a destino',                            '2026-04-10 14:05:00'),
(2, 3, 'Entregado y firmado por el destinatario',        '2026-04-13 15:35:00'),
(3, 2, 'Pendiente de despacho, falta empaque',           '2026-04-12 10:15:00'),
(4, 3, 'Se llamó al cliente para confirmar la dirección', '2026-04-15 16:25:00');

INSERT INTO ubicaciones (id_paquete, latitud, longitud, fecha) VALUES
(1, 4.71100000, -74.07210000, '2026-04-10 14:00:00'),
(1, 4.71250000, -74.07000000, '2026-04-10 14:30:00'),
(1, 4.71500000, -74.06500000, '2026-04-10 15:00:00'),
(2, 6.24420000, -75.58120000, '2026-04-12 09:00:00'),
(2, 6.25000000, -75.57000000, '2026-04-13 14:10:00');

CREATE USER IF NOT EXISTS 'followup_app'@'localhost'     IDENTIFIED BY 'CambiaEstaClave_2026!';
CREATE USER IF NOT EXISTS 'followup_lectura'@'localhost' IDENTIFIED BY 'CambiaOtraClave_2026!';

GRANT SELECT, INSERT, UPDATE ON followup_db.* TO 'followup_app'@'localhost';
GRANT EXECUTE ON PROCEDURE followup_db.sp_cambiar_estado TO 'followup_app'@'localhost';

GRANT SELECT ON followup_db.v_rastreo          TO 'followup_lectura'@'localhost';
GRANT SELECT ON followup_db.v_resumen_estados  TO 'followup_lectura'@'localhost';
GRANT SELECT ON followup_db.historial_estados  TO 'followup_lectura'@'localhost';
GRANT SELECT ON followup_db.ubicaciones        TO 'followup_lectura'@'localhost';
GRANT SELECT ON followup_db.estados            TO 'followup_lectura'@'localhost';

FLUSH PRIVILEGES;

EXPLAIN
SELECT p.numero_serie, e.nombre AS empresa, c.nombre AS cliente, es.nombre_estado
FROM paquetes p
JOIN empresas e  ON e.id_empresa = p.id_empresa
JOIN clientes c  ON c.id_cliente = p.id_cliente
JOIN estados es  ON es.id_estado = p.id_estado
WHERE p.numero_serie = 'PKG001';

EXPLAIN
SELECT h.fecha, es.nombre_estado, h.comentario
FROM historial_estados h
JOIN estados es ON es.id_estado = h.id_estado
WHERE h.id_paquete = 1
ORDER BY h.fecha DESC;

EXPLAIN FORMAT=JSON
SELECT p.numero_serie, u.latitud, u.longitud, u.fecha
FROM ubicaciones u
JOIN paquetes p ON p.id_paquete = u.id_paquete
WHERE p.numero_serie = 'PKG001'
ORDER BY u.fecha DESC
LIMIT 1;

EXPLAIN SELECT usuario, accion, fecha
FROM auditoria IGNORE INDEX (idx_auditoria_fecha)
WHERE fecha >= '2026-01-01' ORDER BY fecha DESC;

EXPLAIN SELECT usuario, accion, fecha
FROM auditoria FORCE INDEX (idx_auditoria_fecha)
WHERE fecha >= '2026-01-01' ORDER BY fecha DESC;

ANALYZE SELECT * FROM v_rastreo WHERE numero_serie = 'PKG001';

START TRANSACTION;

INSERT INTO paquetes (numero_serie, descripcion, id_empresa, id_cliente, fecha_envio)
VALUES ('PKG005', 'Caja de herramientas', 1, 5, CURDATE());

INSERT INTO seguimientos (id_paquete, id_usuario, comentario)
SELECT id_paquete, 2, 'Paquete recibido en bodega'
FROM paquetes WHERE numero_serie = 'PKG005';

SELECT p.numero_serie, p.id_estado, s.comentario
FROM paquetes p JOIN seguimientos s ON s.id_paquete = p.id_paquete
WHERE p.numero_serie = 'PKG005';

COMMIT;

START TRANSACTION;

INSERT INTO paquetes (numero_serie, descripcion, id_empresa, id_cliente, fecha_envio)
VALUES ('PKG999', 'Paquete de prueba', 1, 1, CURDATE());

SELECT numero_serie, id_estado FROM paquetes WHERE numero_serie = 'PKG999';

ROLLBACK;

SELECT numero_serie FROM paquetes WHERE numero_serie = 'PKG999';

DELIMITER $$
CREATE PROCEDURE sp_demo_rollback_regla()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 'Se deshizo todo: el paquete ya estaba cerrado' AS resultado;
  END;
  START TRANSACTION;
  INSERT INTO seguimientos (id_paquete, id_usuario, comentario)
  VALUES (2, 3, 'Nota que no debería quedar guardada');
  UPDATE paquetes SET id_estado = 2 WHERE numero_serie = 'PKG002';
  COMMIT;
END$$
DELIMITER ;

CALL sp_demo_rollback_regla();
DROP PROCEDURE sp_demo_rollback_regla;

SELECT COUNT(*) AS notas_pkg002 FROM seguimientos WHERE id_paquete = 2;

START TRANSACTION;

UPDATE paquetes SET descripcion = 'Teclado mecánico (frágil)' WHERE numero_serie = 'PKG003';
SAVEPOINT despues_de_descripcion;

UPDATE paquetes SET descripcion = 'texto equivocado' WHERE numero_serie = 'PKG003';
ROLLBACK TO SAVEPOINT despues_de_descripcion;

SELECT descripcion FROM paquetes WHERE numero_serie = 'PKG003';
COMMIT;

CALL sp_cambiar_estado('PKG005', 2, 'Salió de bodega', 'laura@mail.com', 4.7160, -74.0640);

SELECT numero_serie, estado, fecha_entrega FROM v_rastreo WHERE numero_serie = 'PKG005';

SELECT * FROM v_resumen_estados;

SELECT numero_serie, empresa, fecha_envio, fecha_entrega,
       TIMESTAMPDIFF(HOUR, fecha_envio, fecha_entrega) AS horas_hasta_entrega
FROM v_rastreo
WHERE fecha_entrega IS NOT NULL;

SELECT e.nombre AS empresa, es.nombre_estado AS estado, COUNT(*) AS total
FROM paquetes p
JOIN empresas e  ON e.id_empresa = p.id_empresa
JOIN estados es  ON es.id_estado = p.id_estado
GROUP BY e.nombre, es.nombre_estado
ORDER BY e.nombre, total DESC;

SELECT h.fecha, es.nombre_estado, h.comentario, h.registrado_por
FROM historial_estados h
JOIN estados es  ON es.id_estado = h.id_estado
JOIN paquetes p  ON p.id_paquete = h.id_paquete
WHERE p.numero_serie = 'PKG002'
ORDER BY h.fecha DESC, h.id_historial DESC;

SELECT fecha, usuario, accion, detalle FROM auditoria ORDER BY fecha DESC, id DESC LIMIT 10;
