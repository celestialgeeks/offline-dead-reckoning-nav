// PS168 — Real Road-Network Routing & Navigation Service
// Queries OSRM driving engine for real turn-by-turn road geometry, distances, and maneuvers

import { haversine } from '../utils/geo';

const OSRM_ROUTING_API = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch a real driving route between two points along actual mapped roads
 * @param {object|Array} origin - { latitude, longitude } or [lon, lat]
 * @param {object|Array} destination - { latitude, longitude } or [lon, lat]
 * @returns {Promise<object>} route data with coordinates, distanceKm, durationMin, steps
 */
export async function getDrivingRoute(origin, destination) {
  const oLon = Array.isArray(origin) ? origin[0] : (origin.longitude ?? origin.lon);
  const oLat = Array.isArray(origin) ? origin[1] : (origin.latitude ?? origin.lat);
  const dLon = Array.isArray(destination) ? destination[0] : (destination.longitude ?? destination.lon);
  const dLat = Array.isArray(destination) ? destination[1] : (destination.latitude ?? destination.lat);

  if (oLon == null || oLat == null || dLon == null || dLat == null) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const url = `${OSRM_ROUTING_API}/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PS168-Navigator-App',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry?.coordinates || [];
        const distanceM = route.distance || 0;
        const durationS = route.duration || 0;

        // Parse turn-by-turn maneuver steps
        const legs = route.legs || [];
        const steps = [];
        for (const leg of legs) {
          for (const step of leg.steps || []) {
            const maneuver = step.maneuver || {};
            const streetName = step.name || 'Road';
            const instruction = formatManeuverInstruction(maneuver, streetName);
            const icon = getManeuverIcon(maneuver.type, maneuver.modifier);

            steps.push({
              instruction,
              streetName,
              icon,
              distanceM: Math.round(step.distance || 0),
              durationS: Math.round(step.duration || 0),
              location: maneuver.location || [0, 0],
            });
          }
        }

        return {
          success: true,
          coordinates,
          distanceM: Math.round(distanceM),
          distanceKm: Number((distanceM / 1000).toFixed(1)),
          durationMin: Math.max(1, Math.round(durationS / 60)),
          steps,
          primaryManeuver: steps[0] || {
            instruction: 'Proceed to route',
            icon: '⬆️',
            distanceM: 100,
          },
        };
      }
    }
  } catch (error) {
    console.warn('[routingService] Online routing error:', error?.message);
  }

  // B1: Honest routing. Do not generate fake zigzag routes.
  return {
    success: false,
    error: 'Could not calculate route. Check network or location.',
  };
}

/**
 * Format maneuver to human-readable voice/banner instruction
 */
function formatManeuverInstruction(maneuver, streetName) {
  const type = maneuver.type || 'turn';
  const modifier = maneuver.modifier || '';
  const road = streetName && streetName !== 'Road' ? ` onto ${streetName}` : '';

  switch (type) {
    case 'depart':
      return `Head ${modifier || 'forward'}${road}`;
    case 'arrive':
      return 'Arriving at destination';
    case 'turn':
      if (modifier.includes('right')) return `Turn right${road}`;
      if (modifier.includes('left')) return `Turn left${road}`;
      if (modifier.includes('straight')) return `Continue straight${road}`;
      return `Turn ${modifier}${road}`;
    case 'roundabout':
    case 'rotary':
      return `Enter roundabout and take exit${road}`;
    case 'fork':
      return `Take the ${modifier} fork${road}`;
    case 'end of road':
      return `Turn ${modifier} at the end of the road${road}`;
    case 'continue':
    case 'new name':
      return `Continue${road}`;
    default:
      return modifier ? `Turn ${modifier}${road}` : `Continue on ${streetName}`;
  }
}

/**
 * Get visual icon for maneuver type
 */
function getManeuverIcon(type, modifier = '') {
  if (type === 'arrive') return '🏁';
  if (modifier.includes('slight right')) return '↗️';
  if (modifier.includes('sharp right')) return '↪️';
  if (modifier.includes('right')) return '➡️';
  if (modifier.includes('slight left')) return '↖️';
  if (modifier.includes('sharp left')) return '↩️';
  if (modifier.includes('left')) return '⬅️';
  if (type === 'roundabout' || type === 'rotary') return '🔄';
  if (modifier.includes('u-turn')) return '🔄';
  return '⬆️';
}

