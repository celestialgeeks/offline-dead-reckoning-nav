// PS168 — Drift Curve Chart (Layer 3)
// Reusable SVG error-drift curve: flat blue → amber rise → red peak → green
// recovery drop. Pure extraction of the ResultsSheet chart so history views
// can render past sessions at any size (width/height props) and with the
// X-axis labels hidden (showLabels=false).

import React, { useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Polyline,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Polygon,
} from 'react-native-svg';
import { DEMO } from '../utils/constants';
import { RADIUS } from '../utils/theme';

// Module-level counter keeps LinearGradient ids unique per chart instance
let gradientSeq = 0;

function DriftCurveChart({ curve, peak, blackoutS, width = 320, height = 120, showLabels = true }) {
  const gradientIdRef = useRef(null);
  if (gradientIdRef.current === null) {
    gradientSeq += 1;
    gradientIdRef.current = `driftGrad-${gradientSeq}`;
  }
  const gradientId = gradientIdRef.current;

  // Guard: a non-finite/undefined blackoutS would poison Math.max into NaN,
  // collapsing the X scale and blanking the SVG. Coerce to 0 so it always draws.
  const bo = Number.isFinite(blackoutS) ? blackoutS : 0;

  const { padding, plotW, plotH, data, x, y, points, areaPoints } = useMemo(() => {
    const pad = { top: 16, right: 12, bottom: showLabels ? 22 : 8, left: 12 };
    const pW = width - pad.left - pad.right;
    const pH = height - pad.top - pad.bottom;

    const d = curve && curve.length > 1 ? curve : [{ t: 0, d: 0 }, { t: 1, d: 0 }];
    const maxT = Math.max(bo + 1.2, ...d.map((p) => p.t), 1);
    const maxD = Math.max(peak?.m ?? 0, ...d.map((p) => p.d), 1);

    const fx = (t) => pad.left + (t / maxT) * pW;
    const fy = (dd) => pad.top + pH - (dd / maxD) * pH;

    const pts = d.map((p) => `${fx(p.t)},${fy(p.d)}`).join(' ');
    const area = `${fx(d[0].t)},${fy(0)} ${pts} ${fx(d[d.length - 1].t)},${fy(0)}`;

    return { padding: pad, plotW: pW, plotH: pH, data: d, x: fx, y: fy, points: pts, areaPoints: area };
  }, [curve, peak, blackoutS, width, height, showLabels]);

  return (
    <View style={styles.plotBox}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#3B82F6" />
            <Stop offset="0.12" stopColor="#60A5FA" />
            <Stop offset="0.55" stopColor={DEMO.amber} />
            <Stop offset="0.9" stopColor="#EF4444" />
            <Stop offset="1" stopColor={DEMO.green} />
          </LinearGradient>
        </Defs>

        {/* Dashed grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={padding.left}
            y1={padding.top + plotH * f}
            x2={padding.left + plotW}
            y2={padding.top + plotH * f}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        <Line x1={padding.left} y1={padding.top + plotH} x2={padding.left + plotW} y2={padding.top + plotH} stroke="#D1D5DB" strokeWidth={1} />

        {/* Area + curve */}
        <Polygon points={areaPoints} fill="rgba(245, 158, 11, 0.10)" />
        <Polyline points={points} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} strokeLinecap="round" />

        {/* Peak marker */}
        {peak && peak.m > 0 && (
          <>
            <Circle cx={x(peak.atS)} cy={y(peak.m)} r={4} fill="#EF4444" />
            <SvgText x={x(peak.atS)} y={y(peak.m) - 8} fontSize={9} fontWeight="700" fill="#EF4444" textAnchor="middle">
              {Math.round(peak.m)}m
            </SvgText>
          </>
        )}

        {/* Recovery marker */}
        <Circle cx={x(data[data.length - 1].t)} cy={y(0)} r={3.5} fill={DEMO.green} />

        {/* X labels */}
        {showLabels && (
          <>
            <SvgText x={padding.left} y={height - 6} fontSize={8.5} fill="#9CA3AF">
              0s (Tunnel In)
            </SvgText>
            <SvgText x={padding.left + plotW / 2} y={height - 6} fontSize={8.5} fill="#9CA3AF" textAnchor="middle">
              {Math.round(bo / 2)}s
            </SvgText>
            <SvgText x={padding.left + plotW} y={height - 6} fontSize={8.5} fill={DEMO.green} fontWeight="700" textAnchor="end">
              {Math.round(bo)}s Recovery
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export default React.memo(DriftCurveChart);

const styles = StyleSheet.create({
  plotBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    alignItems: 'center',
    paddingVertical: 6,
  },
});
