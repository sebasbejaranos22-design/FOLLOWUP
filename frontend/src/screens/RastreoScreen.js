// frontend/src/screens/RastreoScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { followUpApi, setAuthToken } from '../services/api';

// Estados oficiales alineados con el Diagrama de Estados UML
const ESTADOS_ENVIO = [
  { id: 1, nombre: 'En Bodega (Registrado)', color: '#57606F' },
  { id: 2, nombre: 'En Ruta (Tránsito Normal)', color: '#1E90FF' },
  { id: 3, nombre: 'Entregado (Confirmado)', color: '#2ED573' },
  { id: 4, nombre: 'Fallido (Reintento)', color: '#FF4757' },
];

export default function RastreoScreen() {
  const [guia, setGuia] = useState('PKG001');
  const [paquete, setPaquete] = useState(null);
  const [loading, setLoading] = useState(false);

  // Credenciales para Caso de Uso: Iniciar Sesión (+autenticar)
  const [correo, setCorreo] = useState('camila@mail.com');
  const [clave, setClave] = useState('CamilaSegura2026!');
  const [usuarioActivo, setUsuarioActivo] = useState(null);
  const [comentario, setComentario] = useState('Escaneado en portal RFID de bodega');
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });

  // Caso de Uso: Rastrear Paquete en Tiempo Real
  const handleRastrear = async () => {
    if (!guia.trim()) {
      setFeedback({ tipo: 'error', texto: 'Ingresa un número de guía válido.' });
      return;
    }
    setLoading(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      const res = await followUpApi.rastrearPaquete(guia);
      setPaquete(res.data || res);
      setFeedback({ tipo: 'ok', texto: `Guía ${guia.toUpperCase()} sincronizada.` });
    } catch (err) {
      setPaquete(null);
      setFeedback({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Caso de Uso: Iniciar Sesión con validación de Token JWT
  const handleLogin = async () => {
    if (!correo.trim() || !clave) {
      setFeedback({ tipo: 'error', texto: 'Ingresa correo y contraseña.' });
      return;
    }
    setLoading(true);
    try {
      const data = await followUpApi.login(correo, clave);
      setUsuarioActivo(data.usuario || { correo: correo.trim() });
      setFeedback({ tipo: 'ok', texto: 'Sesión JWT iniciada correctamente.' });
    } catch (err) {
      setFeedback({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUsuarioActivo(null);
    setFeedback({ tipo: 'ok', texto: 'Sesión cerrada de forma segura.' });
  };

  // Caso de Uso: Gestionar Flota y Paquetes (+actualizarEstado)
  const handleCambiarEstado = async (idEstado) => {
    if (!usuarioActivo) {
      setFeedback({ tipo: 'error', texto: 'Inicia sesión primero.' });
      return;
    }
    setLoading(true);
    try {
      await followUpApi.actualizarEstado(guia, idEstado, comentario);
      const actualizado = await followUpApi.rastrearPaquete(guia);
      setPaquete(actualizado.data || actualizado);
      setFeedback({ tipo: 'ok', texto: `Estado cambiado a ID ${idEstado} con éxito.` });
    } catch (err) {
      setFeedback({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>FollowUp Satelital</Text>
      <Text style={styles.subtitle}>Rastreo IoT (RFID / GPS) en Tiempo Real</Text>

      {feedback.texto ? (
        <View style={[styles.alert, feedback.tipo === 'error' ? styles.errBg : styles.okBg]}>
          <Text style={styles.alertTxt}>{feedback.texto}</Text>
        </View>
      ) : null}

      {/* TARJETA 1: RASTREO EN TIEMPO REAL (CLIENTE FINAL) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Rastrear Paquete en Tiempo Real</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={guia}
            onChangeText={setGuia}
            placeholder="Ej. PKG001"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btnGreen} onPress={handleRastrear} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnTxt}>Buscar</Text>}
          </TouchableOpacity>
        </View>

        {paquete && (
          <View style={styles.resultBox}>
            <Text style={styles.guiaTxt}>Guía: {paquete.numero_serie || guia.toUpperCase()}</Text>
            <Text style={styles.estadoTxt}>Estado: {paquete.estado || 'Registrado'}</Text>
            <Text style={styles.infoTxt}>Cliente: {paquete.cliente || 'Protegido'}</Text>
            <Text style={styles.infoTxt}>Empresa: {paquete.empresa || 'FollowUp'}</Text>
            {String(paquete.estado).toLowerCase().includes('tránsito') && (
              <Text style={styles.geoTxt}>
                Alerta de Proximidad (Geofencing): Unidad en tránsito activo.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* TARJETA 2: PANEL LOGÍSTICO Y PORTAL RFID (JWT) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Gestión de Flota y Portal RFID (JWT)</Text>
        {!usuarioActivo ? (
          <View>
            <TextInput
              style={[styles.input, styles.mb]}
              value={correo}
              onChangeText={setCorreo}
              placeholder="Correo"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.mb]}
              value={clave}
              onChangeText={setClave}
              placeholder="Contraseña"
              secureTextEntry
            />
            <TouchableOpacity style={styles.btnBlue} onPress={handleLogin} disabled={loading}>
              <Text style={styles.btnTxt}>Iniciar Sesión (JWT)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.userTxt}>Operador: {usuarioActivo.correo || correo}</Text>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutTxt}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.mb]}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Comentario de auditoría RFID"
            />
            {ESTADOS_ENVIO.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.stateBtn, { backgroundColor: item.color }]}
                onPress={() => handleCambiarEstado(item.id)}
                disabled={loading}
              >
                <Text style={styles.btnTxt}>{item.id}. {item.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F4F6F9', padding: 20, paddingTop: 36 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1E272E', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#485460', textAlign: 'center', marginBottom: 18 },
  alert: { padding: 12, borderRadius: 8, marginBottom: 14 },
  errBg: { backgroundColor: '#FFDEDE', borderLeftWidth: 4, borderLeftColor: '#FF4757' },
  okBg: { backgroundColor: '#D4EDDA', borderLeftWidth: 4, borderLeftColor: '#2ED573' },
  alertTxt: { fontSize: 14, color: '#1E272E', fontWeight: '600' },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E0E6ED' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E272E', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  input: { flex: 1, height: 44, backgroundColor: '#F8F9FA', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D2DAE2' },
  mb: { marginBottom: 10 },
  btnGreen: { backgroundColor: '#05C46B', paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center' },
  btnBlue: { backgroundColor: '#1E90FF', height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  resultBox: { marginTop: 14, padding: 12, backgroundColor: '#F8F9FA', borderRadius: 8, borderWidth: 1, borderColor: '#D2DAE2' },
  guiaTxt: { fontSize: 16, fontWeight: 'bold', color: '#1E272E', marginBottom: 4 },
  estadoTxt: { fontSize: 15, fontWeight: 'bold', color: '#1E90FF', marginBottom: 4 },
  infoTxt: { fontSize: 14, color: '#485460', marginBottom: 2 },
  geoTxt: { marginTop: 8, fontSize: 13, color: '#1B4F72', fontWeight: 'bold' },
  userTxt: { fontSize: 14, fontWeight: 'bold', color: '#05C46B' },
  logoutTxt: { fontSize: 13, fontWeight: 'bold', color: '#FF4757' },
  stateBtn: { paddingVertical: 11, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
});