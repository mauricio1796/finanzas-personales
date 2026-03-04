/**
 * Gamification Utilities
 * Funciones para gestionar logros y experiencia del usuario
 */

import { StorageService } from '@/services/StorageService';

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition: (userData: any) => boolean;
  xpReward: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_expense',
    title: 'Primer Gasto',
    icon: '💰',
    description: 'Registra tu primer gasto en la aplicación',
    rarity: 'common',
    condition: (userData) => userData.totalExpenses >= 1,
    xpReward: 50,
  },
  {
    id: 'budget_hero',
    title: 'Héroe del Presupuesto',
    icon: '📊',
    description: 'Mantén tu presupuesto bajo control durante 30 días',
    rarity: 'rare',
    condition: (userData) => userData.daysUnderBudget >= 30,
    xpReward: 200,
  },
  {
    id: 'savings_champion',
    title: 'Campeón de Ahorros',
    icon: '🏆',
    description: 'Ahorra 30% de tus ingresos durante 3 meses',
    rarity: 'epic',
    condition: (userData) => userData.savingsRate >= 0.3 && userData.monthsTracked >= 3,
    xpReward: 500,
  },
  {
    id: 'financial_genius',
    title: 'Genio Financiero',
    icon: '🧠',
    description: 'Alcanza el nivel máximo',
    rarity: 'legendary',
    condition: (userData) => userData.userLevel >= 5,
    xpReward: 1000,
  },
  {
    id: 'early_bird',
    title: 'Madrugador',
    icon: '🌅',
    description: 'Registra gastos antes de las 8 AM durante 7 días',
    rarity: 'common',
    condition: (userData) => userData.earlyMorningStreak >= 7,
    xpReward: 75,
  },
];

/**
 * Verifica y desbloquea logros basado en los datos del usuario
 * @param userData Datos del usuario financiero
 * @returns Array de logros desbloqueados recientemente
 */
export async function checkAchievements(userData: any): Promise<string[]> {
  try {
    const unlockedAchievements: string[] = [];
    const currentAchievements =
      (await StorageService.getValue('unlockedAchievements')) || '[]';
    const unlocked = JSON.parse(currentAchievements);

    for (const achievement of ACHIEVEMENTS) {
      // Verificar si ya está desbloqueado
      if (unlocked.includes(achievement.id)) {
        continue;
      }

      // Verificar si cumple la condición
      if (achievement.condition(userData)) {
        unlocked.push(achievement.id);
        unlockedAchievements.push(achievement.id);

        // Guardar la fecha de desbloqueo
        const achievements = JSON.parse(
          (await StorageService.getValue('achievements')) || '{}'
        );
        achievements[achievement.id] = {
          unlockedDate: new Date().toISOString(),
          xpEarned: achievement.xpReward,
        };
        await StorageService.saveValue(
          'achievements',
          JSON.stringify(achievements)
        );
      }
    }

    // Guardar logros desbloqueados
    if (unlockedAchievements.length > 0) {
      await StorageService.saveValue(
        'unlockedAchievements',
        JSON.stringify(unlocked)
      );
    }

    return unlockedAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

/**
 * Actualiza la experiencia del usuario y verifica subida de nivel
 * @param xpToAdd Cantidad de XP a añadir
 * @param reason Razón de la ganancia de XP
 * @returns Información sobre el nuevo nivel y XP
 */
export async function updateUserExperience(
  xpToAdd: number,
  reason: string = 'general'
): Promise<{
  newXP: number;
  newLevel: number;
  leveledUp: boolean;
  totalXPEarned: number;
}> {
  try {
    // Obtener XP y nivel actual
    const currentXP = parseInt(
      (await StorageService.getValue('userXP')) || '0'
    );
    const currentLevel = parseInt(
      (await StorageService.getValue('userLevel')) || '1'
    );
    const totalXPEarned = parseInt(
      (await StorageService.getValue('totalXPEarned')) || '0'
    );

    // Calcular nuevo XP
    const newTotalXP = currentXP + xpToAdd;
    const xpPerLevel = 1000; // 1000 XP por nivel
    const newLevel = Math.floor(newTotalXP / xpPerLevel) + 1;
    const newXP = newTotalXP % xpPerLevel;
    const leveledUp = newLevel > currentLevel;

    // Guardar valores
    await StorageService.saveValue('userXP', newXP.toString());
    await StorageService.saveValue('userLevel', newLevel.toString());
    await StorageService.saveValue('totalXPEarned', (totalXPEarned + xpToAdd).toString());

    // Registrar XP history
    const xpHistory = JSON.parse(
      (await StorageService.getValue('xpHistory')) || '[]'
    );
    xpHistory.push({
      date: new Date().toISOString(),
      amount: xpToAdd,
      reason,
      level: newLevel,
    });

    // Mantener solo los últimos 30 registros
    if (xpHistory.length > 30) {
      xpHistory.shift();
    }

    await StorageService.saveValue('xpHistory', JSON.stringify(xpHistory));

    return {
      newXP,
      newLevel,
      leveledUp,
      totalXPEarned: totalXPEarned + xpToAdd,
    };
  } catch (error) {
    console.error('Error updating experience:', error);
    return {
      newXP: 0,
      newLevel: 1,
      leveledUp: false,
      totalXPEarned: 0,
    };
  }
}

/**
 * Calcula el nivel del usuario basado en la experiencia total
 * @param totalXP Total de XP acumulada
 * @returns Nivel del usuario
 */
export function calculateUserLevel(totalXP: number): number {
  const xpPerLevel = 1000;
  return Math.floor(totalXP / xpPerLevel) + 1;
}

/**
 * Obtiene el XP necesario para el siguiente nivel
 * @param currentXP XP actual del usuario
 * @returns XP faltante para siguiente nivel
 */
export function getXPToNextLevel(currentXP: number): number {
  const xpPerLevel = 1000;
  return xpPerLevel - (currentXP % xpPerLevel);
}

/**
 * Obtiene la información de una racha
 * @returns Información de la racha actual
 */
export async function getStreakInfo(): Promise<{
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
}> {
  try {
    const currentStreak = parseInt(
      (await StorageService.getValue('currentStreak')) || '0'
    );
    const bestStreak = parseInt(
      (await StorageService.getValue('bestStreak')) || '0'
    );
    const lastActivityDate =
      (await StorageService.getValue('lastActivityDate')) || null;

    return {
      currentStreak,
      bestStreak,
      lastActivityDate,
    };
  } catch (error) {
    console.error('Error getting streak info:', error);
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
    };
  }
}

/**
 * Actualiza la racha del usuario
 * @returns Información actualizada de la racha
 */
export async function updateStreak(): Promise<{
  currentStreak: number;
  bestStreak: number;
  streakBroken: boolean;
}> {
  try {
    const today = new Date().toDateString();
    const lastActivityDate =
      (await StorageService.getValue('lastActivityDate')) || '';
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const currentStreak = parseInt(
      (await StorageService.getValue('currentStreak')) || '0'
    );
    const bestStreak = parseInt(
      (await StorageService.getValue('bestStreak')) || '0'
    );

    let newStreak = currentStreak;
    let newBestStreak = bestStreak;
    let streakBroken = false;

    if (lastActivityDate === today) {
      // Ya hizo actividad hoy
      return { currentStreak: newStreak, bestStreak: newBestStreak, streakBroken };
    }

    if (lastActivityDate === yesterday) {
      // Continúa la racha
      newStreak = currentStreak + 1;
    } else {
      // Racha rota, comienza nueva
      streakBroken = currentStreak > 0;
      newStreak = 1;
    }

    // Actualizar mejor racha
    if (newStreak > bestStreak) {
      newBestStreak = newStreak;
    }

    // Guardar valores
    await StorageService.saveValue('currentStreak', newStreak.toString());
    await StorageService.saveValue('bestStreak', newBestStreak.toString());
    await StorageService.saveValue('lastActivityDate', today);

    return {
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      streakBroken,
    };
  } catch (error) {
    console.error('Error updating streak:', error);
    return {
      currentStreak: 1,
      bestStreak: 0,
      streakBroken: false,
    };
  }
}
