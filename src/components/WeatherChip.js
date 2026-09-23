import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function WeatherChip({ latitude, longitude }) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!latitude || !longitude) return;
    
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const data = await res.json();
        if (isMounted && data.current_weather) {
          setWeather(data.current_weather);
        }
      } catch (e) {
        console.warn('Weather fetch error:', e);
      }
    };

    fetchWeather();
    return () => { isMounted = false; };
  }, [latitude, longitude]);

  if (!weather) return null;

  // Map WMO codes to simple emojis
  const getWeatherEmoji = (code) => {
    if (code === 0) return '☀️'; // Clear
    if (code >= 1 && code <= 3) return '⛅'; // Partly cloudy
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 67) return '🌧️'; // Rain
    if (code >= 71 && code <= 77) return '❄️'; // Snow
    if (code >= 95) return '⛈️'; // Thunderstorm
    return '🌡️';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{getWeatherEmoji(weather.weathercode)}</Text>
      <Text style={styles.text}>{Math.round(weather.temperature)}°C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 130, // below search bar
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  icon: {
    fontSize: 14,
    marginRight: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
  },
});
