import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarLabel: () => null,
        // La app usa su propia barra inferior (BottomNavBar). Ocultamos la
        // tab bar de expo-router para que no ocupe espacio abajo y empuje
        // el menú custom hacia arriba.
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Finanzas',
        }}
      />
    </Tabs>
  );
}
