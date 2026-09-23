// Flujo de onboarding activo (app/(tabs)/index.tsx): Welcome → Profile →
// Salario → Categories → Montos → Confirm.
// BUG-27: se eliminó un flujo paralelo muerto (Goal/Budget/DashboardOverlay/
// Tutorial) que numeraba sus pasos sobre un total distinto y podía dejar el
// onboarding en un estado inconsistente si alguien lo reconectaba.
export { OnboardingWelcome }    from './OnboardingWelcome';
export { OnboardingProfile }    from './OnboardingProfile';
export { OnboardingSalario }    from './OnboardingSalario';
export { OnboardingCategories } from './OnboardingCategories';
export { OnboardingMontos }     from './OnboardingMontos';
export { OnboardingConfirm }    from './OnboardingConfirm';
