import { useMemo } from 'react';
import { useFinance } from '../../state';
import { gastosConsumoPorCategoria, getAhorroRealMes } from '../../utils/ingresoUtils';
import { calcularDesgloseMes, type DesgloseAhorro } from '../../utils/ahorroEvidencia';

/**
 * Desglose de "qué hizo el usuario con Finn" en un mes. null si el mes no
 * tiene registros (no hay nada honesto que decir).
 */
export function useDesgloseAhorro(mes: number, año: number): DesgloseAhorro | null {
  const { transactions, comprasEvitadas, profile } = useFinance();
  const salario = profile?.monthlySalary ?? 0;

  return useMemo(() => {
    const actual = gastosConsumoPorCategoria(transactions, mes, año);
    if (!actual) return null;

    // Hasta 3 meses anteriores con registros (mirando máx. 6 hacia atrás).
    const previos: Record<string, number>[] = [];
    for (let k = 1; k <= 6 && previos.length < 3; k++) {
      const d = new Date(año, mes - k, 1);
      const g = gastosConsumoPorCategoria(transactions, d.getMonth(), d.getFullYear());
      if (g) previos.push(g);
    }

    const hoy = new Date();
    const enCurso = hoy.getMonth() === mes && hoy.getFullYear() === año;
    const diasMes = new Date(año, mes + 1, 0).getDate();

    return calcularDesgloseMes({
      gastoPorCategoria: actual,
      previos,
      fraccionMes: enCurso ? hoy.getDate() / diasMes : 1,
      comprasEvitadas: comprasEvitadas.filter(c => {
        const d = new Date(c.fecha);
        return d.getMonth() === mes && d.getFullYear() === año;
      }),
      apartado: getAhorroRealMes(transactions, salario, mes, año).apartado,
    });
  }, [transactions, comprasEvitadas, salario, mes, año]);
}
