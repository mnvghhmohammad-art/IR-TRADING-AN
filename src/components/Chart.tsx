/**
 * SVG market chart — line/area + candles with volume bars.
 * Pure react-native-svg, no extra chart library.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Rect, Circle, G } from 'react-native-svg';
import { Candle } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  candles: Candle[];
  mode: 'line' | 'candle';
  height?: number;
  loading?: boolean;
}

export function MarketChart({ candles, mode, height = 260, loading }: Props) {
  const { palette } = useTheme();
  const W = 340;
  const H = height;
  const PAD_R = 8;
  const PAD_B = 22;
  const VOL_H = mode === 'candle' ? Math.round(H * 0.18) : 0;
  const plotH = H - PAD_B - VOL_H - 8;

  const data = useMemo(() => (candles.length > 240 ? candles.slice(-240) : candles), [candles]);

  const geom = useMemo(() => {
    if (!data.length) return null;
    const lo = Math.min(...data.map((c) => c.l));
    const hi = Math.max(...data.map((c) => c.h));
    const span = hi - lo || 1;
    const stepX = (W - PAD_R) / Math.max(1, data.length - 1);
    const x = (i: number) => i * stepX;
    const y = (v: number) => 8 + plotH - ((v - lo) / span) * plotH;
    const maxVol = Math.max(...data.map((c) => c.v), 1);
    const vy = (v: number) => (v / maxVol) * (VOL_H - 4);
    return { lo, hi, span, stepX, x, y, vy };
  }, [data, plotH, VOL_H]);

  if (loading || !geom || !data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.sub, fontSize: 13 }}>{loading ? '⏳' : '—'}</Text>
      </View>
    );
  }

  const { x, y, vy, lo, hi } = geom;
  const last = data[data.length - 1];
  const up = last.c >= last.o;

  // line path
  const linePath = data.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(c.c).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${(8 + plotH).toFixed(1)} L0,${(8 + plotH).toFixed(1)} Z`;

  // grid
  const gridYs = [0.2, 0.5, 0.8].map((k) => 8 + plotH * k);
  const fmt = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(v >= 100 ? 0 : 2));

  const candleW = Math.max(1.5, ((W - PAD_R) / data.length) * 0.55);

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette.gold} stopOpacity="0.35" />
            <stop offset="1" stopColor={palette.gold} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridYs.map((gy, idx) => (
          <Line key={idx} x1={0} y1={gy} x2={W - PAD_R} y2={gy} stroke={palette.chartGrid} strokeWidth={1} />
        ))}

        {mode === 'line' ? (
          <>
            <Path d={areaPath} fill="url(#goldFill)" />
            <Path d={linePath} fill="none" stroke={palette.gold} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(data.length - 1)} cy={y(last.c)} r={4} fill={palette.gold} />
          </>
        ) : (
          <>
            {data.map((c, i) => {
              const green = c.c >= c.o;
              const col = green ? palette.green : palette.red;
              const yO = y(c.o);
              const yC = y(c.c);
              const top = Math.min(yO, yC);
              const bodyH = Math.max(1, Math.abs(yC - yO));
              return (
                <G key={i}>
                  <Line x1={x(i)} y1={y(c.h)} x2={x(i)} y2={y(c.l)} stroke={col} strokeWidth={1} />
                  <Rect x={x(i) - candleW / 2} y={top} width={candleW} height={bodyH} fill={col} rx={1} />
                  <Rect x={x(i) - candleW / 2} y={8 + plotH + 4 + (VOL_H - 4 - vy(c.v))} width={candleW} height={vy(c.v)} fill={col} opacity={0.35} />
                </G>
              );
            })}
          </>
        )}

        {/* last price line */}
        <Line x1={0} y1={y(last.c)} x2={W - PAD_R} y2={y(last.c)} stroke={up ? palette.green : palette.red} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ color: palette.sub, fontSize: 10 }}>{fmt(lo)}</Text>
        <Text style={{ color: palette.sub, fontSize: 10 }}>{fmt(hi)}</Text>
      </View>
    </View>
  );
}
