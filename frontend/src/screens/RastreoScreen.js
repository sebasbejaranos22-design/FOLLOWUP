import React, { useState, useEffect, useRef } from 'react';
import MapaLogistico from '../components/MapaLogistico';

import {
  House,
  Search,
  ClipboardList,
  Package,
  Navigation,
} from 'lucide-react-native';

import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';

import { followUpApi, setAuthToken } from '../services/api';

const COLORS = {
  background: '#080D18',
  surface: '#111827',
  surfaceAlt: '#172235',
  border: '#263449',
  navy: '#1E3A5F',
  blue: '#2563EB',
  blueLight: '#60A5FA',
  white: '#F8FAFC',
  muted: '#94A3B8',
  green: '#34D399',
  red: '#FB7185',
  amber: '#FBBF24',
};

const ESTADOS_ENVIO = [
  { id: 1, nombre: 'En Bodega', detalle: 'Paquete registrado', color: '#64748B' },
  { id: 2, nombre: 'En Ruta', detalle: 'Tránsito normal', color: COLORS.blueLight },
  { id: 3, nombre: 'Entregado', detalle: 'Entrega confirmada', color: COLORS.green },
  { id: 4, nombre: 'Fallido', detalle: 'Requiere reintento', color: COLORS.red },
];

const extraerPaquete = (respuesta) => {
  const data = respuesta?.data ?? respuesta;
  return data?.paquete ?? data;
};

const obtenerEstadoId = (paquete) => {
  if (paquete?.id_estado) return Number(paquete.id_estado);

  const estado = String(paquete?.estado || '').toLowerCase();

  if (estado.includes('entreg')) return 3;
  if (estado.includes('tránsito') || estado.includes('transito') || estado.includes('ruta')) return 2;
  if (estado.includes('fall')) return 4;
  if (estado.includes('bodega') || estado.includes('novedad') || estado.includes('registr')) return 1;

  return 0;
};

export default function RastreoScreen() {
  const [seccion, setSeccion] = useState('inicio');
  const [sidebarExpandido, setSidebarExpandido] = useState(true);
  const [paquetes, setPaquetes] = useState([]);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(false);
  const [actividadReciente, setActividadReciente] = useState([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [guia, setGuia] = useState('PKG003');
  const [paquete, setPaquete] = useState(null);
  const [loading, setLoading] = useState(false);

  const [correo, setCorreo] = useState('camila@mail.com');
  const [clave, setClave] = useState('CamilaSegura2026!');
  const [usuarioActivo, setUsuarioActivo] = useState(null);

  const [comentario, setComentario] = useState(
    'Escaneado en portal RFID de bodega'
  );

  const [feedback, setFeedback] = useState({
    tipo: '',
    texto: '',
  });

  // LUCES ANIMADAS DEL FONDO
const luzUno = useRef(new Animated.Value(0)).current;
const luzDos = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const animarLuz = (luz, duracion) => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(luz, {
          toValue: 1,
          duration: duracion,
          useNativeDriver: true,
        }),
        Animated.timing(luz, {
          toValue: 0,
          duration: duracion,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  animarLuz(luzUno, 7000);
  animarLuz(luzDos, 9000);
}, []);

  useEffect(() => {
  const cargarPaquetes = async () => {
    if (!usuarioActivo) {
      setPaquetes([]);
      return;
    }

    try {
      setCargandoEstadisticas(true);

      const data = await followUpApi.listarPaquetes();

      console.log('PAQUETES RECIBIDOS:', data);

      setPaquetes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setPaquetes([]);
    } finally {
      setCargandoEstadisticas(false);
    }
  };

  cargarPaquetes();
}, [usuarioActivo]);

  const totalEnvios = paquetes.length;

  const enBodega = paquetes.filter(
    (p) => Number(p.id_estado) === 1
  ).length;

  const enRuta = paquetes.filter(
    (p) => Number(p.id_estado) === 2
  ).length;

  const entregados = paquetes.filter(
    (p) => Number(p.id_estado) === 3
  ).length;

  // RASTREAR PAQUETE
  const handleRastrear = async () => {
    const numeroGuia = guia.trim().toUpperCase();

    if (!numeroGuia) {
      setFeedback({
        tipo: 'error',
        texto: 'Ingresa un número de guía válido.',
      });
      return;
    }

    setLoading(true);
    setFeedback({ tipo: '', texto: '' });

    try {
      const respuesta = await followUpApi.rastrearPaquete(numeroGuia);
      const datosPaquete = extraerPaquete(respuesta);

      if (!datosPaquete || !datosPaquete.numero_serie) {
        throw new Error('No se recibieron datos válidos del paquete.');
      }

      setPaquete(datosPaquete);

      setFeedback({
        tipo: 'ok',
        texto: `Guía ${numeroGuia} sincronizada correctamente.`,
      });

    } catch (err) {
      setPaquete(null);

      setFeedback({
        tipo: 'error',
        texto: err.message || 'Error al consultar el paquete.',
      });

    } finally {
      setLoading(false);
    }
  };

  // INICIAR SESIÓN JWT
  const handleLogin = async () => {
    if (!correo.trim() || !clave) {
      setFeedback({
        tipo: 'error',
        texto: 'Ingresa correo y contraseña.',
      });
      return;
    }

    setLoading(true);
    setFeedback({ tipo: '', texto: '' });

    try {
      const data = await followUpApi.login(correo, clave);

      setUsuarioActivo(
        data.usuario || { correo: correo.trim() }
      );

      setFeedback({
        tipo: 'ok',
        texto: 'Sesión iniciada correctamente.',
      });

    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err.message || 'Error al iniciar sesión.',
      });

    } finally {
      setLoading(false);
    }
  };

  // CERRAR SESIÓN
  const handleLogout = () => {
    setAuthToken(null);
    setUsuarioActivo(null);

    setFeedback({
      tipo: 'ok',
      texto: 'Sesión cerrada de forma segura.',
    });
  };

  // ACTUALIZAR ESTADO
  const handleCambiarEstado = async (idEstado) => {
    if (!usuarioActivo) {
      setFeedback({
        tipo: 'error',
        texto: 'Inicia sesión primero.',
      });
      return;
    }

    if (!paquete) {
      setFeedback({
        tipo: 'error',
        texto: 'Primero debes consultar un paquete.',
      });
      return;
    }

    if (paquete.cerrado) {
      setFeedback({
        tipo: 'error',
        texto: 'Este paquete ya está cerrado y no admite cambios.',
      });
      return;
    }

    setLoading(true);
    setFeedback({ tipo: '', texto: '' });

    try {
      await followUpApi.actualizarEstado(
        paquete.numero_serie,
        idEstado,
        comentario
      );

      const respuesta = await followUpApi.rastrearPaquete(
        paquete.numero_serie
      );

      const paqueteActualizado = extraerPaquete(respuesta);

      setPaquete(paqueteActualizado);

      setFeedback({
        tipo: 'ok',
        texto: `Estado actualizado: ${paqueteActualizado.estado}`,
      });

    } catch (err) {
      setFeedback({
        tipo: 'error',
        texto: err.message || 'No se pudo actualizar el estado.',
      });

    } finally {
      setLoading(false);
    }
  };

  const estadoActual = obtenerEstadoId(paquete);
  const estadoInfo = ESTADOS_ENVIO.find(
    (item) => item.id === estadoActual
  );

  // COMPONENTES DE NAVEGACIÓN
  const NavItem = ({ id, label, icon }) => (
    <TouchableOpacity
      style={[
        styles.navItem,
        !sidebarExpandido && styles.navItemCollapsed,
        seccion === id && styles.navItemActive,
      ]}
      onPress={() => setSeccion(id)}
      activeOpacity={0.8}
    >
        <View style={styles.navIcon}>
          {icon === 'OPERACIONES' ? (
            <ClipboardList
              size={21}
              color={seccion === id ? '#FFFFFF' : '#94A3B8'}
              strokeWidth={2}
            />
          ) : icon === 'INICIO' ? (
            <House
              size={21}
              color={seccion === id ? '#FFFFFF' : '#94A3B8'}
              strokeWidth={2}
            />
          ) : icon === 'RASTREO' ? (
            <Search
              size={21}
              color={seccion === id ? '#FFFFFF' : '#94A3B8'}
              strokeWidth={2}
            />
          ) : (
            <Text style={styles.navIcon}>{icon}</Text>
          )}
        </View>

      {sidebarExpandido && (
        <Text
          style={[
            styles.navText,
            seccion === id && styles.navTextActive,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  const SectionTitle = ({ eyebrow, title, description }) => (
    <View style={styles.sectionHeading}>
      {!!eyebrow && (
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      )}

      <Text style={styles.sectionTitle}>{title}</Text>

      {!!description && (
        <Text style={styles.sectionDescription}>
          {description}
        </Text>
      )}
    </View>
  );

  
// LÍNEA DE TIEMPO
const renderTimeline = () => {
  if (!paquete) return null;

  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineHeader}>
        <View>
          <Text style={styles.cardEyebrow}>PROGRESO DEL ENVÍO</Text>
          <Text style={styles.cardTitle}>Estado del paquete</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: `${estadoInfo?.color || COLORS.muted}20`,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: estadoInfo?.color || COLORS.muted },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: estadoInfo?.color || COLORS.muted },
            ]}
          >
            {paquete.estado || 'Sin estado'}
          </Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {ESTADOS_ENVIO.map((item, index) => {
          const completed =
            estadoActual === 3
              ? item.id <= 3
              : item.id === estadoActual;

          const active = item.id === estadoActual;

          return (
            <View key={item.id} style={styles.timelineStep}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineNode,
                    completed && {
                      backgroundColor: item.color,
                      borderColor: item.color,
                    },
                    active && styles.timelineNodeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timelineNodeText,
                      completed && styles.timelineNodeTextActive,
                    ]}
                  >
                    {completed ? '✓' : String(index + 1)}
                  </Text>
                </View>

                {index < ESTADOS_ENVIO.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      completed && { backgroundColor: item.color },
                    ]}
                  />
                )}
              </View>

              <View style={styles.timelineCopy}>
                <Text
                  style={[
                    styles.timelineLabel,
                    completed && { color: COLORS.white },
                  ]}
                >
                  {item.nombre}
                </Text>

                <Text style={styles.timelineDetail}>
                  {item.detalle}
                </Text>

                {active && (
                <Text style={styles.currentLabel}>ESTADO ACTUAL</Text>
              )}
              </View>

              
            </View>
          );
        })}
      </View>
    </View>
  );
};

  // BÚSQUEDA DE ENVÍOS
  
  const renderSearch = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <Text style={styles.panelIconText}>⌕</Text>
        </View>

        <View style={styles.panelHeaderCopy}>
          <Text style={styles.cardTitle}>
            Rastrea tu paquete
          </Text>

          <Text style={styles.cardSubtitle}>
            Consulta dónde está tu envío y conoce su estado actual.
          </Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.inputLabel}>
          NÚMERO DE GUÍA
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              style={styles.searchInput}
              value={guia}
              onChangeText={setGuia}
              placeholder="Ej. PKG001"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleRastrear}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, styles.searchButton]}
            onPress={handleRastrear}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Buscar →
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.searchHelper}>
          Introduce el código de seguimiento proporcionado por la empresa transportadora.
        </Text>
      </View>
    </View>
  );


  // INFORMACIÓN DEL PAQUETE
  const renderPackage = () => (
    paquete ? (
      <>
        <View style={styles.packageCard}>
          <View style={styles.packageTopRow}>
            <View>
              <Text style={styles.cardEyebrow}>
                INFORMACIÓN DEL ENVÍO
              </Text>

              <Text style={styles.packageNumber}>
                {paquete.numero_serie}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    `${estadoInfo?.color || COLORS.muted}20`,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      estadoInfo?.color || COLORS.muted,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: estadoInfo?.color || COLORS.muted,
                  },
                ]}
              >
                {paquete.estado}
              </Text>
            </View>
          </View>

          <View style={styles.packageDivider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                DESTINATARIO
              </Text>

              <Text style={styles.detailValue}>
                {paquete.destinatario || paquete.cliente || 'Protegido'}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                TRANSPORTADORA
              </Text>

              <Text style={styles.detailValue}>
                {paquete.empresa || 'FollowUp'}
              </Text>
            </View>
          </View>

          {paquete.cerrado && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Este envío está finalizado y no admite más actualizaciones.
              </Text>
            </View>
          )}

          {(
            String(paquete.estado || '')
              .toLowerCase()
              .includes('tránsito') ||
            String(paquete.estado || '')
              .toLowerCase()
              .includes('transito')
          ) ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerIcon}>⌖</Text>

              <Text style={styles.infoBannerText}>
                Unidad en tránsito activo. Seguimiento de proximidad habilitado.
              </Text>
            </View>
          ) : null}
        </View>

        {renderTimeline()}
      </>
    ) : (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>⌖</Text>

        <Text style={styles.emptyTitle}>
          Tu envío aparecerá aquí
        </Text>

        <Text style={styles.emptyDescription}>
          Busca una guía para consultar su estado, destinatario y progreso de entrega.
        </Text>
      </View>
    )
  );


  
  
// DASHBOARD PRINCIPAL
const renderDashboard = () => {
  const paqueteDestacado = paquetes[0];

  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardTop}>
        <View>
          <Text style={styles.dashboardEyebrow}>CENTRO LOGÍSTICO</Text>
          <Text style={styles.dashboardTitle}>Dashboard</Text>
          <Text style={styles.dashboardSubtitle}>
            Control y seguimiento de tus envíos.
          </Text>
        </View>

        <View style={styles.dashboardLive}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>SISTEMA ACTIVO</Text>
        </View>
      </View>

      {/* INDICADORES */}
      <View style={styles.dashboardStats}>
        {[
          { label: 'TOTAL ENVÍOS', value: totalEnvios, color: COLORS.blueLight },
          { label: 'EN BODEGA', value: enBodega, color: COLORS.amber },
          { label: 'EN RUTA', value: enRuta, color: COLORS.blueLight },
          { label: 'ENTREGADOS', value: entregados, color: COLORS.green },
        ].map((stat) => (
          <View key={stat.label} style={styles.dashboardStat}>
            <Text style={styles.dashboardStatLabel}>{stat.label}</Text>
            <Text style={[styles.dashboardStatValue, { color: stat.color }]}>
              {cargandoEstadisticas ? '...' : stat.value}
            </Text>
          </View>
        ))}
      </View>

      {/* DISTRIBUCIÓN PRINCIPAL */}
      <View style={styles.dashboardColumns}>

        {/* IZQUIERDA: MAPA */}
        <View style={styles.mapPanel}>
          <View style={styles.dashboardPanelHeader}>
            <View>
              <Text style={styles.dashboardPanelTitle}>Mapa logístico</Text>
              <Text style={styles.dashboardPanelSubtitle}>
                Ubicación de los envíos disponibles
              </Text>
            </View>
            <Text style={styles.mapPanelIcon}>⌖</Text>
          </View>

          <MapaLogistico paquetes={paquetes} />
        </View>

        {/* DERECHA: ENVÍOS Y DETALLES */}
        <View style={styles.dashboardRight}>

          {/* TUS ENVÍOS */}
          <View style={styles.shipmentsPanel}>
            <View style={styles.dashboardPanelHeader}>
              <View>
                <Text style={styles.dashboardPanelTitle}>Tus envíos</Text>
                <Text style={styles.dashboardPanelSubtitle}>
                  Paquetes registrados
                </Text>
              </View>
              <Text style={styles.shipmentCount}>{paquetes.length}</Text>
            </View>

            {cargandoEstadisticas ? (
              <ActivityIndicator color={COLORS.blueLight} />
            ) : paquetes.length === 0 ? (
              <Text style={styles.dashboardEmpty}>
                Inicia sesión para consultar tus envíos.
              </Text>
            ) : (
              paquetes.map((item, index) => (
                <TouchableOpacity
                  key={item.numero_serie || index}
                  style={styles.shipmentItem}
                  onPress={() => {
                    setGuia(item.numero_serie);
                    setSeccion('rastreo');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.shipmentItemTop}>
                    <Text style={styles.shipmentGuide}>
                      {item.numero_serie}
                    </Text>

                    <View style={styles.shipmentStatus}>
                      <View
                        style={[
                          styles.shipmentStatusDot,
                          {
                            backgroundColor:
                              Number(item.id_estado) === 3
                                ? COLORS.green
                                : Number(item.id_estado) === 2
                                ? COLORS.blueLight
                                : Number(item.id_estado) === 4
                                ? COLORS.red
                                : COLORS.amber,
                          },
                        ]}
                      />
                      <Text style={styles.shipmentStatusText}>
                        {item.estado || 'Sin estado'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.shipmentRecipient}>
                    {item.destinatario || item.cliente || 'Destinatario protegido'}
                  </Text>

                  <Text style={styles.shipmentCompany}>
                    {item.empresa || 'Transportadora no disponible'}
                  </Text>

                  <Text style={styles.shipmentAction}>
                    VER SEGUIMIENTO →
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* DETALLES DE OPERACIÓN */}
          <View style={styles.operationPanel}>
            <Text style={styles.dashboardPanelTitle}>
              Detalles de operación
            </Text>

            {paqueteDestacado ? (
              <>
                <View style={styles.operationDetailRow}>
                  <Text style={styles.operationLabel}>GUÍA</Text>
                  <Text style={styles.operationValue}>
                    {paqueteDestacado.numero_serie}
                  </Text>
                </View>

                <View style={styles.operationDetailRow}>
                  <Text style={styles.operationLabel}>DESTINATARIO</Text>
                  <Text style={styles.operationValue}>
                    {paqueteDestacado.destinatario ||
                      paqueteDestacado.cliente || 'Protegido'}
                  </Text>
                </View>

                <View style={styles.operationDetailRow}>
                  <Text style={styles.operationLabel}>TRANSPORTADORA</Text>
                  <Text style={styles.operationValue}>
                    {paqueteDestacado.empresa || 'FollowUp'}
                  </Text>
                </View>

                <View style={styles.operationDetailRow}>
                  <Text style={styles.operationLabel}>ESTADO</Text>
                  <Text style={styles.operationValue}>
                    {paqueteDestacado.estado || 'Sin estado'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.dashboardEmpty}>
                No hay información de operaciones disponible.
              </Text>
            )}
          </View>

        </View>
      </View>
    </View>
  );
};



  // SECCIÓN DE RASTREO
  const renderTracking = () => (
    <>
      <SectionTitle
        eyebrow="SEGUIMIENTO INTELIGENTE"
        title="Rastreo de envíos"
        description="Consulta la ubicación lógica y el estado de tus paquetes."
      />

      {renderSearch()}

      {feedback.texto ? (
        <Feedback feedback={feedback} />
      ) : null}

      {renderPackage()}
    </>
  );

  


// PANEL ADMINISTRATIVO
const renderOperations = () => (
  <>
    <SectionTitle
      eyebrow="PANEL ADMINISTRATIVO"
      title="Centro de operaciones"
      description="Gestiona y controla los movimientos de tus paquetes."
    />

    <View style={[styles.panel, styles.operationsMainPanel]}>
      {/* ENCABEZADO */}
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <Text style={styles.panelIconText}>⌘</Text>
        </View>

        <View style={styles.panelHeaderCopy}>
          <Text style={styles.cardTitle}>
            Portal RFID · Acceso seguro
          </Text>
          <Text style={styles.cardSubtitle}>
            Gestión protegida mediante autenticación JWT
          </Text>
        </View>

        {usuarioActivo && (
          <View style={styles.operationsSecureBadge}>
            <Text style={styles.operationsSecureText}>● SEGURO</Text>
          </View>
        )}
      </View>

      {!usuarioActivo ? (
        /* LOGIN */
        <View style={styles.operationsLogin}>
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>

          <TextInput
            style={styles.formInput}
            value={correo}
            onChangeText={setCorreo}
            placeholder="operador@followup.com"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>CONTRASEÑA</Text>

          <TextInput
            style={styles.formInput}
            value={clave}
            onChangeText={setClave}
            placeholder="Ingresa tu contraseña"
            placeholderTextColor="#64748B"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, styles.loginButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Iniciar sesión
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* OPERADOR */}
          <View style={styles.operationsOperator}>
            <View style={styles.operatorAvatar}>
              <Text style={styles.operatorAvatarText}>
                {(usuarioActivo.correo || correo)
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View style={styles.operatorInfo}>
              <Text style={styles.operatorName}>
                {usuarioActivo.correo || correo}
              </Text>
              <Text style={styles.operatorRole}>
                Operador autenticado
              </Text>
            </View>

            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>

          {/* DOS COLUMNAS PRINCIPALES */}
          <View style={styles.operationsGrid}>

            {/* PAQUETE SELECCIONADO */}
            <View style={styles.operationsPackage}>
              <Text style={styles.inputLabel}>
                GUÍA SELECCIONADA
              </Text>

              <View style={styles.operationsGuideRow}>
                <Text style={styles.selectedGuide}>
                  {paquete?.numero_serie || 'Ninguna guía consultada'}
                </Text>

                {paquete && (
                  <View style={styles.operationsStatusBadge}>
                    <Text style={styles.operationsStatusText}>
                      {paquete.cerrado ? '● CERRADO' : '● ACTIVO'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.operationsPackageInfo}>
                <Text style={styles.operationsInfoLabel}>
                  ESTADO ACTUAL
                </Text>
                <Text style={styles.operationsInfoValue}>
                  {paquete?.estado || 'Sin paquete seleccionado'}
                </Text>
              </View>
            </View>

            {/* ACTUALIZAR ESTADO */}
            <View style={styles.operationsStates}>
              <View style={styles.operationsSectionHeader}>
                <Text style={styles.cardTitle}>
                  Actualizar estado
                </Text>
                <Text style={styles.operationsHint}>
                  SELECCIONA UNA ACCIÓN
                </Text>
              </View>

              <View style={styles.operationsStateGrid}>
                {ESTADOS_ENVIO.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.stateButton,
                      styles.operationsStateButton,
                      (!paquete || paquete.cerrado || loading) &&
                        styles.disabledButton,
                    ]}
                    onPress={() => handleCambiarEstado(item.id)}
                    disabled={!paquete || paquete.cerrado || loading}
                  >
                    <View
                      style={[
                        styles.stateButtonDot,
                        { backgroundColor: item.color },
                      ]}
                    />

                    <View style={styles.stateButtonCopy}>
                      <Text style={styles.stateButtonTitle}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.stateButtonDescription}>
                        {item.detalle}
                      </Text>
                    </View>

                    <Text style={styles.stateButtonArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!paquete && (
                <Text style={styles.helperText}>
                  Consulta primero una guía en la sección Rastreo.
                </Text>
              )}

              {paquete?.cerrado && (
                <Text style={styles.warningText}>
                  El paquete está cerrado. No se permiten más cambios.
                </Text>
              )}
            </View>
          </View>

          {/* AUDITORÍA */}
          <View style={styles.operationsAudit}>
            <View style={styles.operationsSectionHeader}>
              <Text style={styles.cardTitle}>
                Comentario de auditoría
              </Text>
              <Text style={styles.operationsHint}>
                REGISTRO DE ACTIVIDAD
              </Text>
            </View>

            <TextInput
              style={[
                styles.formInput,
                styles.commentInput,
                styles.operationsAuditInput,
              ]}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Describe el movimiento o escaneo RFID..."
              placeholderTextColor="#64748B"
              multiline
            />
          </View>
        </>
      )}
    </View>

    {feedback.texto ? (
      <Feedback feedback={feedback} />
    ) : null}
  </>
);




  // INTERFAZ PRINCIPAL
  return (
    <View style={styles.screen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.luzAmbiental,
          styles.luzAzul,
          {
            opacity: luzUno.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.28],
            }),
            transform: [
              {
                translateX: luzUno.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 100],
                }),
              },
              {
                translateY: luzUno.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 100],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.luzAmbiental,
          styles.luzCeleste,
          {
            opacity: luzDos.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.2],
            }),
            transform: [
              {
                translateX: luzDos.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, -80],
                }),
              },
              {
                translateY: luzDos.interpolate({
                  inputRange: [0, 1],
                  outputRange: [80, -60],
                }),
              },
            ],
          },
        ]}
      />

      {/* BURBUJAS ANIMADAS */}
<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 90,
      height: 90,
      top: 100,
      left: 80,
      opacity: 0.12,
      transform: [{ translateY: luzUno.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -70],
      }) }],
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 35,
      height: 35,
      top: 280,
      right: 100,
      opacity: 0.18,
      transform: [{ translateY: luzDos.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
      }) }],
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 60,
      height: 60,
      top: 500,
      left: 250,
      opacity: 0.10,
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 25,
      height: 25,
      top: 180,
      right: 300,
      opacity: 0.20,
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 110,
      height: 110,
      bottom: 100,
      right: 80,
      opacity: 0.08,
    },
  ]}
/>

<Animated.View
  pointerEvents="none"
  style={[
    styles.burbuja,
    {
      width: 45,
      height: 45,
      bottom: 250,
      left: 100,
      opacity: 0.15,
    },
  ]}
/>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />

      <View style={styles.topBar}>
  <View>
    <Text style={styles.brandName}>FollowUp</Text>
    <Text style={styles.brandTagline}>
      GESTIÓN LOGÍSTICA
    </Text>
  </View>
</View>

      <View style={styles.mainLayout}>

      <View style={[
        styles.navBar,
        { width: sidebarExpandido ? 220 : 72 }
      ]}>
        <TouchableOpacity
        style={styles.sidebarToggle}
        onPress={() => setSidebarExpandido(!sidebarExpandido)}
        >
        <Text style={styles.sidebarToggleText}>
        {sidebarExpandido ? '❮' : '❯'}
    </Text>
  </TouchableOpacity>

    <NavItem
      id="inicio"
      label={sidebarExpandido ? "Inicio" : ""}
      icon="INICIO"
    />

  <NavItem
    id="rastreo"
    label={sidebarExpandido ? "Rastreo" : ""}
    icon="RASTREO"
  />

  <NavItem
    id="operaciones"
    label={sidebarExpandido ? "Operaciones" : ""}
    icon={<ClipboardList size={22} />}
  />

  <View style={{ flex: 1 }} />

<View style={styles.sidebarProfile}>
  <View style={styles.sidebarAvatar}>
    <Text style={styles.sidebarAvatarText}>
      {(usuarioActivo?.correo || correo || 'U')
        .charAt(0).toUpperCase()}
    </Text>
  </View>

  {sidebarExpandido && (
    <View style={styles.sidebarProfileInfo}>
      <Text style={styles.sidebarProfileName}>
        {usuarioActivo?.correo || 'Usuario'}
      </Text>
      <Text style={styles.sidebarProfileEmail}>
        {usuarioActivo?.correo || correo}
      </Text>
    </View>
  )}

  {sidebarExpandido && (
    <TouchableOpacity onPress={handleLogout}>
      <Text style={styles.sidebarLogout}>↪</Text>
    </TouchableOpacity>
  )}
</View>
</View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {seccion === 'inicio' && renderDashboard()}

        {seccion === 'rastreo' && renderTracking()}

        {seccion === 'operaciones' && renderOperations()}

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>
            FOLLOWUP <Text style={styles.footerDot}>●</Text>
          </Text>

          <Text style={styles.footerText}>
            Tecnología para conectar cada entrega.
          </Text>

          <Text style={styles.footerVersion}>
            PLATAFORMA DE GESTIÓN LOGÍSTICA
          </Text>
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

// MENSAJES DE RESPUESTA
function Feedback({ feedback }) {
  const isError = feedback.tipo === 'error';

  return (
    <View
      style={[
        styles.feedback,
        isError
          ? styles.feedbackError
          : styles.feedbackSuccess,
      ]}
    >
      <View
        style={[
          styles.feedbackDot,
          {
            backgroundColor: isError
              ? COLORS.red
              : COLORS.green,
          },
        ]}
      />

      <Text style={styles.feedbackText}>
        {feedback.texto}
      </Text>
    </View>
  );
}
// ESTILOS GENERALES
const styles = StyleSheet.create({
  brandLogo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},

brandLogoIcon: {
  width: 48,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
},

brandName: {
  color: '#FFFFFF',
  fontSize: 22,
  fontWeight: '900',
  letterSpacing: 1,
},

  brandTagline: {
    color: '#94A3B8',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 3,
  },
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    luzAmbiental: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    zIndex: 0,
  },

  luzAzul: {
    backgroundColor: '#2563EB',
    top: 100,
    left: -100,
  },

  luzCeleste: {
    backgroundColor: '#38BDF8',
    top: 350,
    right: -120,
  },
  burbuja: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#3B82F6',
    zIndex: 0,
  },

  mainLayout: {
  flex: 1,
  flexDirection: 'row',
  minHeight: 0,
  },

  topBar: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  brandMarkText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '900',
  },

  brandCopy: {
    flex: 1,
  },

  brandName: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
  },

  brandTagline: {
    color: COLORS.muted,
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 3,
  },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#102A28',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 6,
  },

  liveText: {
    color: COLORS.green,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

    navBar: {
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 10,
    minHeight: '100%',
  },

  sidebarToggle: {
  width: 42,
  height: 42,
  borderRadius: 10,
  backgroundColor: COLORS.surfaceAlt,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  marginBottom: 12,
  },

  sidebarToggleText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },  

  navContent: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
  },

  navItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 15,
  paddingVertical: 10,
  borderRadius: 9,
  gap: 7,
  },  

  navItemCollapsed: {
  paddingHorizontal: 8,
  justifyContent: 'center',
},

  navItemActive: {
    backgroundColor: '#1D3150',
  },

  navIcon: {
  color: COLORS.muted,
  fontSize: 23,
  },

  navText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  navTextActive: {
    color: COLORS.white,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    padding: 18,
    paddingBottom: 30,
  },

  sectionHeading: {
    marginBottom: 18,
  },

  eyebrow: {
    color: COLORS.blueLight,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 7,
  },

  sectionTitle: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },

  welcomeCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 17,
    padding: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 205,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#31547D',
  },

  welcomeTextWrap: {
    flex: 1,
    zIndex: 1,
  },

  welcomeEyebrow: {
    color: '#BFDBFE',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  welcomeTitle: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 12,
    maxWidth: 240,
  },

  welcomeDescription: {
    color: '#D3E1F2',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    maxWidth: 245,
  },

  welcomeButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },

  welcomeButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  welcomeOrb: {
  width: 150,
  height: 150,
  position: 'absolute',
  right: 25,
  top: 30,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  borderWidth: 0,
},
  
  packageIllustration: {
  width: 76,
  height: 76,
  borderRadius: 18,
  backgroundColor: '#2D527D',
  borderWidth: 1,
  borderColor: '#5B8FC5',
  alignItems: 'center',
  justifyContent: 'center',
},

packageIcon: {
  color: '#FFFFFF',
  fontSize: 38,
  fontWeight: '700',
},

routeLine: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: 110,
  marginTop: 14,
  marginBottom: 8,
},

routePoint: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#60A5FA',
},

routeDestination: {
  color: '#93C5FD',
  fontSize: 28,
  fontWeight: '700',
},

  welcomeOrbText: {
    color: '#DBEAFE',
    fontSize: 44,
    fontWeight: '300',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  statCard: {
  flex: 1,
  minHeight: 138,
  backgroundColor: COLORS.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 18,
  justifyContent: 'center',
  },

  statIcon: {
    color: COLORS.blueLight,
    fontSize: 18,
    marginBottom: 9,
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  statValue: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '800',
    marginTop: 7,
  },

  statFoot: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 4,
  },

  panel: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  panelIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    backgroundColor: '#1B3152',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  panelIconText: {
    color: COLORS.blueLight,
    fontSize: 24,
  },

  panelHeaderCopy: {
    flex: 1,
  },

  cardTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  cardSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 15,
  },

  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },

  quickLinkIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1B3152',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  quickLinkIconText: {
    color: COLORS.blueLight,
    fontSize: 20,
  },

  quickLinkCopy: {
    flex: 1,
  },

  quickLinkTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },

  quickLinkDescription: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },

  quickArrow: {
    color: COLORS.muted,
    fontSize: 25,
    paddingHorizontal: 5,
  },

  panelDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 5,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },

  footerBrand: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },

  footerDot: {
    color: COLORS.blueLight,
    fontSize: 8,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 6,
  },

  footerVersion: {
    color: '#536176',
    fontSize: 8,
    letterSpacing: 1.1,
    marginTop: 9,
  },

  inputLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },

  searchSection: {
  marginTop: 4,
},

searchInputWrapper: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  height: 52,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#3B5272',
  backgroundColor: '#0B1423',
  paddingHorizontal: 12,
},

searchIcon: {
  color: COLORS.blueLight,
  fontSize: 20,
  marginRight: 8,
},

searchHelper: {
  color: COLORS.muted,
  fontSize: 10,
  lineHeight: 16,
  marginTop: 9,
},

  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  searchInput: {
    flex: 1,
    height: 50,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: COLORS.white,
    paddingHorizontal: 10,
    fontSize: 14,
  },

  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 17,
  },

  searchButton: {
    minWidth: 88,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 9,
  },

  feedback: {
    borderRadius: 9,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
    borderWidth: 1,
  },

  feedbackError: {
    backgroundColor: '#321D2A',
    borderColor: '#713044',
  },

  feedbackSuccess: {
    backgroundColor: '#102C29',
    borderColor: '#1E594B',
  },

  feedbackDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 9,
  },

  feedbackText: {
    color: COLORS.white,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 25,
    alignItems: 'center',
    marginBottom: 14,
  },

  emptyIcon: {
    color: COLORS.blueLight,
    fontSize: 35,
    marginBottom: 10,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 270,
  },

  packageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 13,
  },

  packageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  cardEyebrow: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  packageNumber: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },

  packageDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
  },

  detailItem: {
    flex: 1,
  },

  detailLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  detailValue: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },

  warningBanner: {
    backgroundColor: '#35252A',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },

  warningText: {
  color: '#FB7185',
  fontSize: 13,
  fontWeight: '800',
  marginTop: 12,
  lineHeight: 22,
},

  infoBanner: {
    backgroundColor: '#142B47',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoBannerIcon: {
    color: COLORS.blueLight,
    fontSize: 18,
    marginRight: 8,
  },

  infoBannerText: {
    color: '#BFDBFE',
    fontSize: 10,
    flex: 1,
    lineHeight: 15,
  },

  timelineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },

  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },

    
  timeline: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 68,
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 34,
    alignItems: 'center',
  },
  timelineNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#40516A',
    backgroundColor: '#0B1423',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineNodeActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  timelineNodeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  timelineNodeTextActive: {
    color: '#07111F',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    backgroundColor: '#263449',
    marginTop: 3,
  },
  timelineCopy: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 3,
    paddingBottom: 17,
  },
  timelineLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineDetail: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  currentLabel: {
    color: '#60A5FA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    paddingTop: 5,
  },


  formInput: {
    minHeight: 45,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#34445B',
    backgroundColor: '#0B1423',
    color: COLORS.white,
    paddingHorizontal: 12,
    fontSize: 12,
    marginBottom: 9,
  },

  loginButton: {
    marginTop: 8,
  },

  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },

  operatorAvatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  operatorAvatarText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
  },

  operatorInfo: {
    flex: 1,
  },

  operatorName: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  operatorRole: {
    color: COLORS.green,
    fontSize: 9,
    marginTop: 4,
  },

  logoutText: {
    color: COLORS.red,
    fontSize: 10,
    fontWeight: '800',
  },

  selectedGuide: {
    color: COLORS.blueLight,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },

  selectedGuideCard: {
  flex: 1,
  minHeight: 290,
  justifyContent: 'space-between',
  padding: 18,
  backgroundColor: '#111B2B',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#263449',
},

  selectedGuideContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },

  commentInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 11,
  },

  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#0D1727',
    borderRadius: 9,
    padding: 11,
    marginBottom: 8,
  },

  stateButtonDot: {
  width: 12,
  height: 12,
  borderRadius: 6,
  marginRight: 14,
},

  stateButtonCopy: {
    flex: 1,
  },

  stateButtonTitle: {
  color: '#E2E8F0',
  fontSize: 16,
  fontWeight: '800',
},

  stateButtonDescription: {
  color: '#94A3B8',
  fontSize: 13,
  marginTop: 5,
},

  stateButtonArrow: {
    color: COLORS.muted,
    fontSize: 22,
    paddingHorizontal: 5,
  },

  disabledButton: {
    opacity: 0.4,
  },

  
dashboard: {
  gap: 11,
},
dashboardTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
},
dashboardEyebrow: {
  fontSize: 11,
  fontWeight: '800',
  color: COLORS.blueLight,
},
dashboardTitle: {
  fontSize: 26,
  fontWeight: '900',
  color: COLORS.white,
},
dashboardSubtitle: {
  fontSize: 12,
  color: COLORS.muted,
},
dashboardLive: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#102A28',
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 20,
},
dashboardStats: {
  flexDirection: 'row',
  gap: 10,
},
dashboardStat: {
  flex: 1,
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 11,
  padding: 11,
  minHeight: 72,
},
dashboardStatLabel: {
  fontSize: 10,
  fontWeight: '800',
  color: COLORS.muted,
},
dashboardStatValue: {
  fontSize: 24,
  fontWeight: '900',
},
dashboardColumns: {
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 10,
},

shipmentsPanel: {
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 10,
  minWidth: 0,
},
dashboardRight: {
  flex: 1.8,
  minWidth: 0,
  justifyContent: 'space-between',
  gap: 10,
},

dashboardPanelHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 9,
},
dashboardPanelTitle: {
  fontSize: 15,
  fontWeight: '800',
  color: COLORS.white,
},
dashboardPanelSubtitle: {
  fontSize: 11,
  color: COLORS.muted,
},
shipmentCount: {
  color: COLORS.blueLight,
  fontSize: 17,
  fontWeight: '900',
},
shipmentItem: {
  backgroundColor: '#0B1423',
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 9,
  padding: 9,
  marginBottom: 7,
},
shipmentItemTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
shipmentGuide: {
  fontSize: 12,
  fontWeight: '900',
  color: COLORS.white,

},
shipmentStatus: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  alignSelf: 'center',
  marginRight: 2,
},
shipmentStatusDot: {
  width: 12,
  height: 12,
  borderRadius: 6,
},
shipmentStatusText: {
  fontSize: 14,
  fontWeight: '800',
  color: COLORS.muted,
},
shipmentRecipient: {
  fontSize: 12,
  fontWeight: '700',
  color: COLORS.white,
},
shipmentCompany: {
  fontSize: 11,
  color: COLORS.muted,
},
shipmentAction: {
  fontSize: 10,
  fontWeight: '900',
  color: COLORS.blueLight,
},
mapPanel: {
  flex: 1.1,
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 10,
  overflow: 'hidden',
  minWidth: 0,
},
mapPanelIcon: {
  color: COLORS.blueLight,
  fontSize: 23,
},
operationPanel: {
  flex: 1,
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 12,
  minHeight: 0,
  justifyContent: 'space-between',
},
operationDetailRow: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
  paddingVertical: 8,
  gap: 10,
},
operationLabel: {
  fontSize: 11,
  fontWeight: '800',
  color: COLORS.blueLight,
},
operationValue: {
  fontSize: 12,
  fontWeight: '700',
  color: COLORS.white,
},
dashboardEmpty: {
  color: COLORS.muted,
  fontSize: 11,
  paddingVertical: 16,
  lineHeight: 17,
},


operationsContainer: {
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 14,
  padding: 16,
  gap: 16,
},

operationsHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingBottom: 14,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
},

operationsHeaderIcon: {
  width: 44,
  height: 44,
  borderRadius: 12,
  backgroundColor: '#1D3558',
  alignItems: 'center',
  justifyContent: 'center',
},

operationsHeaderIconText: {
  color: COLORS.blueLight,
  fontSize: 25,
  fontWeight: '700',
},

operationsHeaderCopy: {
  flex: 1,
},

operationsHeaderTitle: {
  color: COLORS.white,
  fontSize: 15,
  fontWeight: '900',
},

operationsHeaderSubtitle: {
  color: COLORS.muted,
  fontSize: 11,
  marginTop: 4,
},

operationsSecureBadge: {
  backgroundColor: '#063D32',
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 20,
},

operationsSecureDot: {
  width: 7,
  height: 7,
  borderRadius: 4,
  backgroundColor: COLORS.green,
},

operationsSecureText: {
  color: '#34D399',
  fontSize: 10,
  fontWeight: '900',
},

operationsLogin: {
  gap: 18,
},

operationsOperatorCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#0B1423',
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 11,
  padding: 12,
  gap: 12,
},

operationsLogout: {
  paddingHorizontal: 10,
  paddingVertical: 8,
},

operationsGuideCard: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#101F35',
  borderWidth: 1,
  borderColor: '#29476B',
  borderRadius: 11,
  padding: 14,
  gap: 10,
},

operationsGuideInfo: {
  flex: 1,
  gap: 5,
},

operationsLabel: {
  color: COLORS.muted,
  fontSize: 10,
  fontWeight: '900',
  letterSpacing: 1,
},

operationsGuideNumber: {
  color: COLORS.blueLight,
  fontSize: 21,
  fontWeight: '900',
},

operationsGuideStatus: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 7,
},

operationsGuideDot: {
  width: 9,
  height: 9,
  borderRadius: 5,
},

operationsGuideStatusText: {
  color: COLORS.white,
  fontSize: 10,
  fontWeight: '900',
},

operationsSection: {
  gap: 11,
},

operationsSectionHeading: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
},

operationsSectionTitle: {
  color: COLORS.white,
  fontSize: 20,
  fontWeight: '900',
},

operationsSectionHint: {
  color: COLORS.muted,
  fontSize: 9,
  fontWeight: '800',
  letterSpacing: 0.8,
},

operationsComment: {
  minHeight: 105,
  paddingTop: 12,
  textAlignVertical: 'top',
},

operationsStatesGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 10,
},

operationsStateCard: {
  width: '48.5%',
  minHeight: 76,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#0B1423',
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 10,
  padding: 12,
  gap: 10,
},

operationsStateIndicator: {
  width: 11,
  height: 11,
  borderRadius: 6,
},

operationsStateCopy: {
  flex: 1,
  gap: 4,
},

operationsStateTitle: {
  color: COLORS.white,
  fontSize: 12,
  fontWeight: '900',
},

operationsStateDescription: {
  color: COLORS.muted,
  fontSize: 10,
},

operationsStateArrow: {
  color: COLORS.muted,
  fontSize: 22,
  fontWeight: '400',
},


operationsSecureBadge: {
  backgroundColor: '#063D32',
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 20,
},

operationsSecureText: {
  color: '#34D399',
  fontSize: 10,
  fontWeight: '900',
},

operationsLogin: {
  paddingTop: 18,
},

operationsOperator: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#0B1423',
  borderWidth: 1,
  borderColor: '#263449',
  borderRadius: 12,
  padding: 14,
  marginTop: 16,
  marginBottom: 18,
},

operationsGrid: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 16,
  marginTop: 18,
  marginBottom: 18,
},

operationsPackage: {
  flex: 0.85,
  minWidth: 0,
  backgroundColor: '#111C2E',
  borderWidth: 1,
  borderColor: '#263449',
  borderRadius: 12,
  padding: 18,
},

operationsGuideRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 8,
},

operationsStatusBadge: {
  backgroundColor: '#123B35',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 20,
},

operationsStatusText: {
  color: '#34D399',
  fontSize: 10,
  fontWeight: '900',
},

operationsPackageInfo: {
  borderTopWidth: 1,
  borderTopColor: '#263449',
  marginTop: 20,
  paddingTop: 16,
},

operationsInfoLabel: {
  color: '#94A3B8',
  fontSize: 10,
  fontWeight: '800',
  marginBottom: 8,
},

operationsInfoValue: {
  color: '#F8FAFC',
  fontSize: 15,
  fontWeight: '800',
},

operationsStates: {
  flex: 1.35,
  minWidth: 0,
  backgroundColor: '#0E1829',
  borderWidth: 1,
  borderColor: '#263449',
  borderRadius: 12,
  padding: 16,
},

operationsSectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 14,
},

operationsHint: {
  color: '#94A3B8',
  fontSize: 9,
  fontWeight: '800',
},

operationsStateGrid: {
  flex: 1,
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignContent: 'space-evenly',
  gap: 12,
  minHeight: 220,
},

operationsStateButton: {
  width: '48.5%',
  minHeight: 82,
  justifyContent: 'center',
  paddingHorizontal: 18,
  paddingVertical: 16,
},

operationsAudit: {
  marginTop: 0,
  backgroundColor: '#0E1829',
  borderWidth: 1,
  borderColor: '#263449',
  borderRadius: 12,
  padding: 16,
},

operationsAuditInput: {
  minHeight: 85,
  textAlignVertical: 'top',
  marginBottom: 0,
},

operationsMainPanel: {
  minHeight: 680,
  justifyContent: 'space-between',
},

sidebarProfile: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#172338',
  borderRadius: 12,
  padding: 10,
  marginTop: 12,
  gap: 10,
},

sidebarAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#24466D',
  alignItems: 'center',
  justifyContent: 'center',
},

sidebarAvatarText: {
  color: COLORS.white,
  fontSize: 17,
  fontWeight: '900',
},

sidebarProfileInfo: {
  flex: 1,
  minWidth: 0,
},

sidebarProfileName: {
  color: COLORS.white,
  fontSize: 12,
  fontWeight: '800',
},

sidebarProfileEmail: {
  color: COLORS.muted,
  fontSize: 10,
  marginTop: 3,
},

sidebarLogout: {
  color: '#F87171',
  fontSize: 23,
  fontWeight: '800',
},
});
