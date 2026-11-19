import { Redirect } from 'expo-router';

export default function ProgressScreen() {
  return <Redirect href={{ pathname: '/', params: { section: 'tu', perfil: 'progreso' } }} />;
}
