import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../mapa.css';

const iconoPaquete = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function MapaLogistico({ paquetes = [] }) {
    console.log('MAPA RENDERIZADO:', paquetes.length, paquetes);
    console.log('MAPA LOGÍSTICO:', paquetes);
    console.table(paquetes.map(p => ({
    guia: p.numero_serie,
    estado: p.estado,
    latitud: p.ultima_latitud,
    longitud: p.ultima_longitud
    })));

    const ubicaciones = paquetes.filter((p) => {
    const lat = Number(p.ultima_latitud);
    const lon = Number(p.ultima_longitud);

    return (
      p.ultima_latitud !== null &&
      p.ultima_longitud !== null &&
      p.ultima_latitud !== '' &&
      p.ultima_longitud !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    );
  });

  if (typeof document === 'undefined') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SEGUIMIENTO GPS</Text>

        <Text style={styles.counter}>
          {ubicaciones.length} ubicaciones
        </Text>
      </View>

      <View style={styles.map}>
        <MapContainer
          center={[4.711, -74.0721]}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />

            <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            className="map-labels-bright"
            />

          {ubicaciones.map((p) => (
            <Marker
              key={p.numero_serie}
              position={[
                Number(p.ultima_latitud),
                Number(p.ultima_longitud),
              ]}
              icon={iconoPaquete}
            >
              <Popup>
                <strong>{p.numero_serie}</strong>
                <br />
                {p.descripcion}
                <br />
                Estado: {p.estado}
                <br />
                {p.empresa}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {paquetes.length - ubicaciones.length} paquete(s) sin ubicación GPS registrada
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  
  container: {
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  padding: 0,
  marginTop: 12,
},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  counter: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  map: {
    height: 380,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  footer: {
    marginTop: 12,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
