import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export const StatusBarSim: React.FC = () => {
  const [time, setTime] = useState('');
  const textColor = '#374151';

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.bar}>
      {/* Time — left */}
      <Text style={[styles.time, { color: textColor }]}>{time}</Text>

      {/* Dynamic Island — center */}
      <View style={styles.island} />

      {/* Status icons — right */}
      <View style={styles.icons}>
        {/* Signal bars */}
        <View style={styles.signalGroup}>
          {[3, 5, 7, 9].map((h, i) => (
            <View
              key={i}
              style={[
                styles.signalBar,
                { height: h, backgroundColor: textColor, opacity: i < 3 ? 1 : 0.35 },
              ]}
            />
          ))}
        </View>

        {/* WiFi */}
        <Text style={[styles.icon, { color: textColor }]}>WiFi</Text>

        {/* Battery */}
        <View style={[styles.battery, { borderColor: textColor }]}>
          <View style={styles.batteryFill} />
          <View style={[styles.batteryNub, { backgroundColor: `${textColor}50` }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    backgroundColor: '#FFFFFF',
  },
  time: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    width: 46,
  },
  island: {
    width: 100,
    height: 28,
    borderRadius: 20,
    backgroundColor: '#111827',
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    width: 46,
    justifyContent: 'flex-end',
  },
  signalGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 10,
  },
  signalBar: {
    width: 3,
    borderRadius: 1,
  },
  icon: {
    fontSize: 10,
    fontWeight: '600',
  },
  battery: {
    width: 20,
    height: 10,
    borderWidth: 1.2,
    borderRadius: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 1.5,
    position: 'relative',
  },
  batteryFill: {
    flex: 1,
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 1.5,
  },
  batteryNub: {
    position: 'absolute',
    right: -3.5,
    width: 2,
    height: 4.5,
    borderRadius: 1,
  },
});
