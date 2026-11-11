// frontend/App.js
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import RastreoScreen from './src/screens/RastreoScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F9" />
      <RastreoScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
});