// PS168 — App Entry Point
// Single-screen app: one map with the engine layer floating on top
// No navigation stack — portability IS the product

import React from 'react';
import MapScreen from './src/screens/MapScreen';

export default function App() {
  return <MapScreen />;
}

