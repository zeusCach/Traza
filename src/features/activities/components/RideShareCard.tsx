import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Share2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { AppButton, AppCard } from '@/components';
import type { Activity, ActivityRoute } from '@/database/activities';
import { colors, radius, spacing, typography } from '@/theme';

import { activityDateFormat, averageSpeed, formatDistance, formatDuration, formatElevationGain, formatSpeed } from '../format';
import { projectRoute } from './ActivityRouteMap';

const width = 360;
const height = 640;
const pngSize = { width: 1080, height: 1920 };
const pngMimeType = 'image/png';
const pngHeader = 'iVBORw0KGgoAAAANSUhEUg';
const modes = [
  { id: 'transparente', label: 'Transparente' },
  { id: 'oscuro', label: 'Oscuro' },
  { id: 'detalle', label: 'Detalle' },
] as const;
type Mode = typeof modes[number]['id'];
type ExportAction = 'share' | 'save' | 'gallery';

function capturePng(svg: Svg) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tiempo de exportación agotado')), 10_000);
    try {
      svg.toDataURL(result => {
        clearTimeout(timeout);
        const base64 = result.replace(/^data:image\/png;base64,/i, '').replace(/\s/g, '');
        if (base64.startsWith(pngHeader)) resolve(base64);
        else reject(new Error('La captura no es un PNG'));
      }, pngSize);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export function RideShareCard({ activity, route }: { activity: Activity; route: ActivityRoute }) {
  const svg = useRef<Svg>(null);
  const exporting = useRef(false);
  const [mode, setMode] = useState<Mode>('transparente');
  const [action, setAction] = useState<ExportAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const transparent = mode === 'transparente';
  const detailed = mode === 'detalle';
  const routeHeight = transparent ? 240 : detailed ? 330 : 370;
  const segments = useMemo(() => projectRoute(route, routeHeight), [route, routeHeight]);
  const start = segments[0]?.[0];
  const end = segments.at(-1)?.at(-1);
  const speed = averageSpeed(activity.distanceM, activity.durationMs);
  const metrics = [
    { label: 'Distancia', value: activity.distanceM === null ? '—' : `${formatDistance(activity.distanceM)} km` },
    { label: 'Velocidad media', value: speed === null ? '—' : `${formatSpeed(speed)} km/h` },
    { label: 'Desnivel positivo', value: activity.elevationGainM == null ? '—' : `${formatElevationGain(activity.elevationGainM)} m` },
  ];
  const summaryMetrics = [
    metrics[0],
    { ...metrics[2], label: 'Desnivel' },
    { label: 'Duración', value: formatDuration(activity.durationMs) },
  ];

  async function exportImage(nextAction: ExportAction) {
    if (!svg.current || exporting.current) return;
    exporting.current = true;
    setAction(nextAction);
    setError(null);
    setNotice(null);
    try {
      if (nextAction === 'gallery' && (Platform.OS === 'ios' ||
        (Platform.OS === 'android' && Number(Platform.Version) < 29))) {
        const permission = await requestPermissionsAsync(true);
        if (!permission.granted) {
          setError('Permite guardar fotos en los ajustes de TRAZA o elige guardar en archivos.');
          return;
        }
      }
      const base64 = await capturePng(svg.current);
      const filename = `TRAZA-${activity.startedAt}-${mode}.png`;
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:${pngMimeType};base64,${base64}`;
        link.download = filename;
        link.click();
      } else if (nextAction === 'save') {
        const directory = await Directory.pickDirectoryAsync();
        const file = directory.createFile(filename, pngMimeType);
        await file.write(base64, { encoding: 'base64' });
        setNotice(`Archivo guardado: ${file.name}`);
      } else {
        const file = new File(Paths.cache, filename);
        await file.write(base64, { encoding: 'base64' });
        if (nextAction === 'gallery') {
          await Asset.create(file.uri);
          setNotice('PNG guardado en la galería.');
        } else {
          if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible');
          await Sharing.shareAsync(file.uri, { mimeType: pngMimeType, UTI: 'public.png', dialogTitle: 'Compartir rodada' });
        }
      }
    } catch (exportError) {
      const cancelled = exportError instanceof Error && 'code' in exportError &&
        (exportError.code === 'ERR_PICKER_CANCELLED' || exportError.code === 'ERR_FILE_PICKING_CANCELLED');
      if (!cancelled) setError('No pudimos exportar la imagen. Intenta de nuevo.');
    } finally {
      exporting.current = false;
      setAction(null);
    }
  }

  return (
    <AppCard style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Exportar recorrido</Text>
      <View style={styles.modes}>
        {modes.map(option => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === option.id, disabled: action !== null }}
            disabled={action !== null}
            style={[styles.mode, mode === option.id && styles.selectedMode]}
            onPress={() => {
              setMode(option.id);
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={[styles.modeLabel, mode === option.id && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.preview}>
        <Svg
          ref={svg}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Vista previa del PNG con el trazo y las métricas de la rodada"
        >
          {!transparent && <Rect width={width} height={height} fill={detailed ? colors.background : '#080A09'} />}
          {detailed && (
            <>
              <Defs>
                <Pattern id="share-grid" width={24} height={24} patternUnits="userSpaceOnUse">
                  <Path d="M 0 24 V 0 H 24" fill="none" stroke={colors.border} />
                </Pattern>
              </Defs>
              <Rect x={16} y={90} width={328} height={routeHeight} rx={12} fill={colors.surface} />
              <Rect x={16} y={90} width={328} height={routeHeight} rx={12} fill="url(#share-grid)" />
            </>
          )}
          {transparent ? <G fill="#FFFFFF" fontFamily="sans-serif" textAnchor="middle">
            {metrics.map(({ label, value }, index) => (
              <G key={label} transform={`translate(0 ${index * 92})`}>
                <SvgText x={180} y={65} fontSize={20} fontWeight="600">{label}</SvgText>
                <SvgText x={180} y={110} fontSize={43} fontWeight="800">{value}</SvgText>
              </G>
            ))}
            <SvgText x={180} y={603} fontSize={44} fontWeight="900" letterSpacing={2}>TRAZA</SvgText>
          </G> : <G fill="#FFFFFF" fontFamily="sans-serif">
            {detailed ? (
              <>
                <SvgText x={22} y={48} fontSize={29} fontWeight="900" letterSpacing={2}>TRAZA</SvgText>
                <SvgText x={22} y={72} fontSize={13} fill={colors.textSecondary}>{activityDateFormat.format(activity.startedAt)}</SvgText>
                <SvgText x={325} y={118} textAnchor="end" fontSize={13}>↑ N</SvgText>
                <Circle cx={24} cy={444} r={4} fill="#FFFFFF" />
                <SvgText x={35} y={448} fontSize={12}>Inicio</SvgText>
                <Circle cx={94} cy={444} r={4} fill={colors.primary} />
                <SvgText x={105} y={448} fontSize={12}>Fin</SvgText>
                {[...summaryMetrics, metrics[1]].map(({ label, value }, index) => (
                  <G key={label} transform={`translate(${index % 2 ? 190 : 22} ${index < 2 ? 484 : 555})`}>
                    <SvgText fontSize={14} fill={colors.textSecondary}>{label}</SvgText>
                    <SvgText y={31} fontSize={25} fontWeight="800">{value}</SvgText>
                  </G>
                ))}
              </>
            ) : (
              <G textAnchor="middle">
                <SvgText x={180} y={449} fontSize={33} fontWeight="900" letterSpacing={2}>TRAZA</SvgText>
                {summaryMetrics.map(({ label, value }, index) => (
                  <G key={label} transform={`translate(${60 + index * 120} 501)`}>
                    <SvgText fontSize={14} fontWeight="600">{label}</SvgText>
                    <SvgText y={29} fontSize={23} fontWeight="800">{value}</SvgText>
                  </G>
                ))}
                <SvgText x={180} y={581} fontSize={15}>{metrics[1].label} · {metrics[1].value}</SvgText>
              </G>
            )}
          </G>}
          <G transform={`translate(0 ${transparent ? 322 : detailed ? 90 : 35})`} stroke={colors.primary} strokeWidth={5}>
            {segments.map((segment, index) => segment.length === 1 ? (
              <Circle key={index} cx={segment[0].x} cy={segment[0].y} r={3} fill={colors.primary} stroke="none" />
            ) : (
              <Polyline
                key={index}
                points={segment.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {detailed && start && <Circle cx={start.x} cy={start.y} r={6} fill="#FFFFFF" stroke={colors.background} strokeWidth={2} />}
            {detailed && end && <Circle cx={end.x} cy={end.y} r={4} fill={colors.primary} stroke={colors.background} strokeWidth={2} />}
          </G>
        </Svg>
      </View>
      <Text style={styles.caption}>{transparent ? 'PNG transparente' : 'PNG'} · 1080 × 1920</Text>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.caption}>{notice}</Text>}
      {Platform.OS !== 'web' && (
        <AppButton
          label="Guardar PNG en galería"
          onPress={() => exportImage('gallery')}
          disabled={action !== null && action !== 'gallery'}
          loading={action === 'gallery'}
        />
      )}
      <AppButton
        icon={Share2}
        label={Platform.OS === 'web' ? 'Descargar PNG' : 'Compartir PNG'}
        onPress={() => exportImage('share')}
        variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
        disabled={action !== null && action !== 'share'}
        loading={action === 'share'}
      />
      {Platform.OS !== 'web' && (
        <AppButton
          label="Guardar PNG en archivos"
          variant="ghost"
          onPress={() => exportImage('save')}
          disabled={action !== null && action !== 'save'}
          loading={action === 'save'}
        />
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { ...typography.subtitle, color: colors.textPrimary },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  mode: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  selectedMode: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeLabel: { ...typography.label, color: colors.textPrimary },
  selectedLabel: { color: colors.background },
  preview: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: width / height,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  caption: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.bodySmall, color: colors.error },
});
