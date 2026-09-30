/**
 * Punto de entrada: el de expo-router + la tarea en segundo plano de la
 * captura automática (Android), que debe registrarse al cargar el bundle para
 * que el servicio nativo pueda lanzarla con la app cerrada.
 */
import 'expo-router/entry';
import { AppRegistry } from 'react-native';
import { tareaCapturaSegundoPlano } from './src/services/CapturaSegundoPlano';

AppRegistry.registerHeadlessTask('FinnCapturaTask', () => tareaCapturaSegundoPlano);
