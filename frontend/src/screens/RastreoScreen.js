import React, { useState, useEffect } from 'react';
import {
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

  useEffect(() => {
  const cargarPaquetes = async () => {
    if (!usuarioActivo) {
      setPaquetes([]);
      return;
    }

    try {
      setCargandoEstadisticas(true);

      const data = await followUpApi.listarPaquetes();

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
      <Text
        style={[
          styles.navIcon,
          seccion === id && styles.navTextActive,
        ]}
      >
        {icon}
      </Text>

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
            <Text style={styles.cardEyebrow}>
              PROGRESO DEL ENVÍO
            </Text>

            <Text style={styles.cardTitle}>
              Estado del paquete
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
                        completed && {
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  )}
                </View>

                <View style={styles.timelineCopy}>
                  <Text
                    style={[
                      styles.timelineLabel,
                      active && { color: COLORS.white },
                    ]}
                  >
                    {item.nombre}
                  </Text>

                  <Text style={styles.timelineDetail}>
                    {item.detalle}
                  </Text>
                </View>

                {active && (
                  <Text style={styles.currentLabel}>
                    ACTUAL
                  </Text>
                )}
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
            Rastrear un envío
          </Text>

          <Text style={styles.cardSubtitle}>
            Consulta el estado de tu paquete en tiempo real
          </Text>
        </View>
      </View>

      <Text style={styles.inputLabel}>
        NÚMERO DE GUÍA
      </Text>

      <View style={styles.searchRow}>
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

        <TouchableOpacity
          style={[styles.primaryButton, styles.searchButton]}
          onPress={handleRastrear}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Buscar
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>
        Ingresa el código de seguimiento proporcionado por la empresa transportadora.
      </Text>
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
  const renderDashboard = () => (
    <>
      <SectionTitle
        eyebrow="CENTRO DE CONTROL"
        title="Resumen general"
        description="Bienvenido a tu plataforma inteligente de seguimiento logístico."
      />

      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTextWrap}>
          <Text style={styles.welcomeEyebrow}>
            FOLLOWUP SATELITAL
          </Text>

          <Text style={styles.welcomeTitle}>
            Cada envío, bajo control.
          </Text>

          <Text style={styles.welcomeDescription}>
            Consulta movimientos y mantén el control de tus operaciones desde un solo lugar.
          </Text>

          <TouchableOpacity
            style={styles.welcomeButton}
            onPress={() => setSeccion('rastreo')}
          >
            <Text style={styles.welcomeButtonText}>
              Rastrear paquete →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeOrb}>
          <View style={styles.packageIllustration}>
            <Text style={styles.packageIcon}>▣</Text>
          </View>

          <View style={styles.routeLine}>
            <View style={styles.routePoint} />
            <View style={styles.routePoint} />
            <View style={styles.routePoint} />
          </View>

          <Text style={styles.routeDestination}>⌖</Text>
        </View>
      </View>

      
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statIcon}>▣</Text>
        <Text style={styles.statLabel}>TOTAL DE ENVÍOS</Text>
        <Text style={styles.statValue}>{cargandoEstadisticas ? '...' : totalEnvios}</Text>
        <Text style={styles.statFoot}>Paquetes registrados</Text>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statIcon}>◉</Text>
        <Text style={styles.statLabel}>EN BODEGA</Text>
        <Text style={styles.statValue}>{cargandoEstadisticas ? '...' : enBodega}</Text>
        <Text style={styles.statFoot}>Pendientes de despacho</Text>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statIcon}>➜</Text>
        <Text style={styles.statLabel}>EN RUTA</Text>
        <Text style={styles.statValue}>{cargandoEstadisticas ? '...' : enRuta}</Text>
        <Text style={styles.statFoot}>En tránsito</Text>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statIcon}>✓</Text>
        <Text style={styles.statLabel}>ENTREGADOS</Text>
        <Text style={styles.statValue}>{cargandoEstadisticas ? '...' : entregados}</Text>
        <Text style={styles.statFoot}>Entregas confirmadas</Text>
      </View>
    </View>


      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelIcon}>
            <Text style={styles.panelIconText}>⌖</Text>
          </View>

          <View style={styles.panelHeaderCopy}>
            <Text style={styles.cardTitle}>
              Accesos rápidos
            </Text>

            <Text style={styles.cardSubtitle}>
              Continúa con una operación
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.quickLink}
          onPress={() => setSeccion('rastreo')}
        >
          <View style={styles.quickLinkIcon}>
            <Text style={styles.quickLinkIconText}>⌕</Text>
          </View>

          <View style={styles.quickLinkCopy}>
            <Text style={styles.quickLinkTitle}>
              Consultar envío
            </Text>

            <Text style={styles.quickLinkDescription}>
              Busca una guía y revisa su recorrido
            </Text>
          </View>

          <Text style={styles.quickArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.panelDivider} />

        <TouchableOpacity
          style={styles.quickLink}
          onPress={() => setSeccion('operaciones')}
        >
          <View style={styles.quickLinkIcon}>
            <Text style={styles.quickLinkIconText}>⚙</Text>
          </View>

          <View style={styles.quickLinkCopy}>
            <Text style={styles.quickLinkTitle}>
              Portal de operaciones
            </Text>

            <Text style={styles.quickLinkDescription}>
              Acceso de operadores y control RFID
            </Text>
          </View>

          <Text style={styles.quickArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </>
  );

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
        description="Gestiona los estados de los paquetes con acceso autorizado."
      />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelIcon}>
            <Text style={styles.panelIconText}>⌘</Text>
          </View>

          <View style={styles.panelHeaderCopy}>
            <Text style={styles.cardTitle}>
              Portal RFID · Acceso seguro
            </Text>

            <Text style={styles.cardSubtitle}>
              Autenticación protegida mediante token JWT
            </Text>
          </View>
        </View>

        {!usuarioActivo ? (
          <>
            <Text style={styles.inputLabel}>
              CORREO ELECTRÓNICO
            </Text>

            <TextInput
              style={styles.formInput}
              value={correo}
              onChangeText={setCorreo}
              placeholder="operador@followup.com"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>
              CONTRASEÑA
            </Text>

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
          </>
        ) : (
          <>
            <View style={styles.operatorRow}>
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

            <View style={styles.panelDivider} />

            <Text style={styles.inputLabel}>
              GUÍA SELECCIONADA
            </Text>

            <Text style={styles.selectedGuide}>
              {paquete?.numero_serie || 'Ninguna guía consultada'}
            </Text>

            <Text style={styles.inputLabel}>
              COMENTARIO DE AUDITORÍA
            </Text>

            <TextInput
              style={[styles.formInput, styles.commentInput]}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Describe el movimiento o escaneo RFID"
              placeholderTextColor="#64748B"
              multiline
            />

            <Text style={styles.inputLabel}>
              ACTUALIZAR ESTADO
            </Text>

            {ESTADOS_ENVIO.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.stateButton,
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

            {!paquete && (
              <Text style={styles.helperText}>
                Primero consulta una guía en la sección Rastreo para habilitar los cambios.
              </Text>
            )}

            {paquete?.cerrado && (
              <Text style={styles.warningText}>
                El paquete está cerrado. No se permiten más cambios.
              </Text>
            )}
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
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />

      <View style={styles.topBar}>
        <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>F</Text>
      </View>
        

        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>FOLLOWUP</Text>

          <Text style={styles.brandTagline}>
            LOGÍSTICA INTELIGENTE
          </Text>
        </View>

        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />

          <Text style={styles.liveText}>
            SISTEMA ACTIVO
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
    icon="▦"
  />

  <NavItem
    id="rastreo"
    label={sidebarExpandido ? "Rastreo" : ""}
    icon="⌕"
  />

  <NavItem
    id="operaciones"
    label={sidebarExpandido ? "Operaciones" : ""}
    icon="⚙"
  />
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
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
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

  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  searchInput: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B5272',
    backgroundColor: '#0B1423',
    color: COLORS.white,
    paddingHorizontal: 16,
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
    color: COLORS.red,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
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
    paddingTop: 2,
  },

  timelineStep: {
    flexDirection: 'row',
    minHeight: 55,
    alignItems: 'flex-start',
  },

  timelineRail: {
    width: 27,
    alignItems: 'center',
  },

  timelineNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#536176',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  timelineNodeActive: {
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  timelineNodeText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
  },

  timelineNodeTextActive: {
    color: COLORS.background,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 29,
    backgroundColor: COLORS.border,
    marginTop: 2,
  },

  timelineCopy: {
    flex: 1,
    paddingLeft: 10,
    paddingTop: 2,
  },

  timelineLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },

  timelineDetail: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  currentLabel: {
    color: COLORS.blueLight,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingTop: 4,
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
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 11,
  },

  stateButtonCopy: {
    flex: 1,
  },

  stateButtonTitle: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  stateButtonDescription: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  stateButtonArrow: {
    color: COLORS.muted,
    fontSize: 22,
    paddingHorizontal: 5,
  },

  disabledButton: {
    opacity: 0.4,
  },
});
