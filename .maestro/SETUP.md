
# FinancyAI — Pruebas E2E con Maestro

## Instalación rápida

```bash
# Mac/Linux
curl -Ls "https://get.maestro.mobile.dev" | bash

# Windows (WSL recomendado)
wsl curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Ejecutar pruebas

```bash
# 1. Iniciar la app en simulador/emulador
cd finanzas-personales
npx expo start --android   # o --ios

# 2. En otra terminal, ejecutar todos los flujos
cd .maestro
pwsh run_tests.ps1

# Ejecutar solo uno
pwsh run_tests.ps1 -Flow 01_auth

# Con reporte HTML
pwsh run_tests.ps1 -Report

# Modo visual interactivo
pwsh run_tests.ps1 -Studio
```

## testIDs pendientes de agregar en los componentes

Para que Maestro identifique los elementos, el desarrollador debe agregar
`testID` a los siguientes componentes:

### Onboarding
| testID | Componente | Archivo |
|---|---|---|
| `onboarding-welcome` | View raíz | OnboardingWelcome.tsx |
| `onboarding-next-btn` | Pressable continuar | Todos los pasos |
| `onboarding-profile-screen` | View raíz | OnboardingProfile.tsx |
| `employment-type-employed` | Pressable opción | OnboardingProfile.tsx |
| `income-type-fixed` | Pressable opción | OnboardingProfile.tsx |
| `concern-savings` | Pressable opción | OnboardingProfile.tsx |
| `onboarding-salary-screen` | View raíz | OnboardingSalario.tsx |
| `salary-input` | TextInput | OnboardingSalario.tsx |
| `onboarding-categories-screen` | View raíz | OnboardingCategories.tsx |
| `category-item-arriendo` | Pressable | OnboardingCategories.tsx |
| `category-item-alimentacion` | Pressable | OnboardingCategories.tsx |
| `category-item-transporte` | Pressable | OnboardingCategories.tsx |
| `onboarding-montos-screen` | View raíz | OnboardingMontos.tsx |
| `budget-input-arriendo` | TextInput | OnboardingMontos.tsx |
| `onboarding-confirm-screen` | View raíz | OnboardingConfirm.tsx |
| `onboarding-finish-btn` | Pressable | OnboardingConfirm.tsx |

### Dashboard
| testID | Componente | Archivo |
|---|---|---|
| `dashboard-screen` | View raíz | Dashboard.tsx |
| `dashboard-balance` | Text saldo total | Dashboard.tsx |
| `fab-add-transaction` | FAB botón + | Dashboard.tsx |
| `transaction-modal` | Modal | Dashboard.tsx |
| `tx-type-income` | Pressable Ingreso | Modal transacción |
| `tx-type-expense` | Pressable Gasto | Modal transacción |
| `tx-amount-input` | TextInput | Modal transacción |
| `tx-category-selector` | Pressable | Modal transacción |
| `tx-description-input` | TextInput | Modal transacción |
| `tx-save-btn` | Pressable guardar | Modal transacción |

### Navegación
| testID | Componente | Archivo |
|---|---|---|
| `nav-dashboard` | Tab item | Navigation.tsx |
| `nav-finn` | Tab item | Navigation.tsx |
| `nav-metas` | Tab item | Navigation.tsx |
| `nav-estadisticas` | Tab item | Navigation.tsx |
| `nav-gamificacion` | Tab item | Navigation.tsx |
| `nav-configuracion` | Tab item | Navigation.tsx |
| `nav-historial` | Tab item | Navigation.tsx |

### Finn IA
| testID | Componente | Archivo |
|---|---|---|
| `finn-chat-screen` | View raíz | BotIA.tsx |
| `finn-message-input` | TextInput | BotIA.tsx |
| `finn-send-btn` | Pressable | BotIA.tsx |
| `finn-response-bubble` | View mensaje AI | BotIA.tsx |

### Metas
| testID | Componente | Archivo |
|---|---|---|
| `metas-screen` | View raíz | MetasScreen.tsx |
| `metas-add-btn` | Pressable + | MetasScreen.tsx |
| `meta-form-modal` | Modal | MetasScreen.tsx |
| `meta-title-input` | TextInput | MetasScreen.tsx |
| `meta-type-savings` | Pressable | MetasScreen.tsx |
| `meta-target-input` | TextInput | MetasScreen.tsx |
| `meta-priority-high` | Pressable | MetasScreen.tsx |
| `meta-deadline-input` | TextInput | MetasScreen.tsx |
| `meta-save-btn` | Pressable | MetasScreen.tsx |

### Configuración
| testID | Componente | Archivo |
|---|---|---|
| `configuracion-screen` | View raíz | ConfiguracionScreen.tsx |
| `perfil-nombre` | Text | ConfiguracionScreen.tsx |
| `premium-section` | View | ConfiguracionScreen.tsx |
| `cerrar-sesion-btn` | Pressable | ConfiguracionScreen.tsx |

## Variables de entorno para testing

Editar `.maestro/config.yaml`:
```yaml
env:
  TEST_EMAIL: "tu-email-de-prueba@dominio.com"
  TEST_NAME:  "Usuario Test"
  TEST_SALARY: "3500000"
```

> Para OTP en testing: configurar Supabase en modo development con
> OTP bypass o usar una dirección de email real con acceso.
