// Directory structure documentation

/**
 * src/
 * ├── components/          # Reusable UI components
 * │   ├── ui/             # Base UI components (Button, Card, Input, etc.)
 * │   ├── charts/         # Chart components
 * │   ├── layout/         # Layout components (Header, Drawer, etc.)
 * │   └── index.ts        # Component exports
 * │
 * ├── screens/            # Screen/Page components
 * │   ├── Dashboard/
 * │   ├── Gastos/
 * │   ├── Ingresos/
 * │   ├── Categorias/
 * │   ├── Estadisticas/
 * │   ├── BotIA/
 * │   ├── Usuario/
 * │   └── index.ts        # Screen exports
 * │
 * ├── core/               # Business logic
 * │   ├── engine/
 * │   │   ├── calculations.ts
 * │   │   └── financeEngine.ts
 * │   └── context/        # (Deprecated - use state/ instead)
 * │
 * ├── state/              # Global state management
 * │   ├── FinanceContext.tsx
 * │   ├── hooks/
 * │   │   └── useFinanceData.ts
 * │   └── index.ts        # State exports
 * │
 * ├── services/           # External services
 * │   └── storage/
 * │       └── StorageService.ts
 * │
 * ├── hooks/              # Custom React hooks
 * │   ├── useColorScheme.ts
 * │   └── useThemeColor.ts
 * │
 * ├── utils/              # Utility functions
 * │   ├── formatters.ts
 * │   └── validators.ts
 * │
 * ├── constants/          # Constants
 * │   ├── colors.ts
 * │   ├── spacing.ts
 * │   └── index.ts
 * │
 * ├── config/             # Configuration files
 * │   ├── environment.ts
 * │   └── screenConfig.ts
 * │
 * ├── types/              # Global TypeScript types
 * │   └── index.ts
 * │
 * └── models/             # Data models
 *     └── Category.ts
 */

export {};
