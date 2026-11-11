import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import RastreoScreen from './src/screens/RastreoScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080D18"
      />
      <RastreoScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080D18',
  },
});
