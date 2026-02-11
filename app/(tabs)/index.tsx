import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  View,
  Modal,
  Animated,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useFinance } from '@/src/context/FinanceContext';
import { Transaction, calculateBalance } from '@/src/core/financeEngine';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryColors } from '@/constants/theme';


/* ---------------- GRID CONFIG ---------------- */

const getGridConfig = (width: number) => {
  if (width >= 1400) return { columns: 5, padding: 48 };
  if (width >= 1024) return { columns: 4, padding: 32 };
  if (width >= 768) return { columns: 3, padding: 24 };
  return { columns: 2, padding: 16 };
};

const GAP = 12;

/* ---------------- SCREEN ---------------- */

export default function HomeScreen() {
  const { categories } = useFinance();
  const { width } = useWindowDimensions();
  const { columns: numColumns, padding } = getGridConfig(width);

  const ITEM_SIZE =
    (width - padding * 2 - GAP * (numColumns - 1)) / numColumns;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const [salaryEntered, setSalaryEntered] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState('');
  const [categoriesConfirmed, setCategoriesConfirmed] = useState(false);
  const [budgetDefined, setBudgetDefined] = useState(false);
  const [budgetAssigned, setBudgetAssigned] = useState(false);
  const [categoryPrices, setCategoryPrices] = useState<Record<string, string>>({});
  const [monthStarted, setMonthStarted] = useState(false);
  const [selectedCategoriesForMonth, setSelectedCategoriesForMonth] = useState<string[]>([]);

  const scaleAnims = useRef<Record<string, Animated.Value>>({}).current;

  // Ref para animación del salario modal
  const salaryModalAnim = useRef(new Animated.Value(0)).current;

  // Panel animation for the centered categories card
  const panelAnim = useRef(new Animated.Value(0)).current;

  // When entering the categories modal, animate panel and tiles
  useEffect(() => {
    if (!salaryEntered) {
      Animated.spring(salaryModalAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    } else {
      salaryModalAnim.setValue(0);
    }
  }, [salaryEntered]);

  // When entering the categories modal, animate panel and tiles
  useEffect(() => {
    if (salaryEntered && !categoriesConfirmed) {
      // prepare tile anims to a smaller value first
      categories.forEach(c => {
        const a = initAnim(c.id);
        a.setValue(0.86);
      });

      Animated.parallel([
        Animated.spring(panelAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
        Animated.stagger(
          60,
          categories.map(c => Animated.spring(initAnim(c.id), { toValue: 1, friction: 6, useNativeDriver: true }))
        ),
      ]).start();
    } else {
      panelAnim.setValue(0);
    }
  }, [salaryEntered, categoriesConfirmed]);

  const initAnim = (id: string) => {
    if (!scaleAnims[id]) scaleAnims[id] = new Animated.Value(1);
    return scaleAnims[id];
  };

  const animatePress = (id: string) => {
    const anim = initAnim(id);
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1.05, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const toggleCategorySelection = (id: string) => {
    animatePress(id);
    setSelectedCategoriesForMonth(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addTransaction = () => {
    if (!amount || !selectedCategory) return;
    const cat = categories.find(c => c.id === selectedCategory);
    if (!cat) return;

    setTransactions(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        amount: Number(amount),
        category: cat.name,
        date: new Date(),
        type,
      },
    ]);

    setAmount('');
  };

  // Calcular total de presupuestos
  const totalBudget = selectedCategoriesForMonth.reduce((sum, catId) => {
    return sum + (Number(categoryPrices[catId]) || 0);
  }, 0);

  // Calcular neto
  const netValue = Number(monthlySalary) - totalBudget;

  // Actualizar precio de categoría
  const updateCategoryPrice = (categoryId: string, price: string) => {
    setCategoryPrices(prev => ({
      ...prev,
      [categoryId]: price,
    }));
  };

  const balance = calculateBalance(transactions);
  const monthCategories = categories.filter(c =>
    selectedCategoriesForMonth.includes(c.id)
  );

  /* ---------------- CATEGORY ITEM ---------------- */

  const renderCategoryItem = (
    cat: any,
    onSelect: (id: string) => void,
    isSelected: boolean
  ) => {
    const colors = CategoryColors[cat.name] || CategoryColors['Otros'];
    const anim = initAnim(cat.id);

    return (
      <Animated.View
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          transform: [{ scale: anim }],
        }}
      >
        <Pressable
          style={[
            styles.gridItem,
            {
              backgroundColor: isSelected ? colors.bg : '#1A3A52',
              borderColor: isSelected ? colors.light : '#00D9FF',
            },
          ]}
          onPress={() => {
            animatePress(cat.id);
            onSelect(cat.id);
          }}
        >
          {isSelected && (
            <View style={[styles.glow, { backgroundColor: colors.light }]} />
          )}
          <ThemedText style={styles.icon}>{cat.icon}</ThemedText>
          <ThemedText style={styles.label} numberOfLines={2}>
            {cat.name}
          </ThemedText>
        </Pressable>
      </Animated.View>
    );
  };

  /* ---------------- MODAL SALARIO ---------------- */

  if (!salaryEntered) {
    return (
      <Modal visible transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ThemedView style={styles.modalContainer}>
              <Animated.View
                style={[
                  styles.salaryModalBox,
                  {
                    transform: [{ scale: salaryModalAnim }],
                    opacity: salaryModalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                  },
                ]}
              >
                <ThemedText type="title" style={styles.salaryModalTitle}>
                  💰 Ingresa tu salario
                </ThemedText>
                <ThemedText style={styles.salaryModalSubtitle}>
                  ¿Cuál fue tu ingreso este mes?
                </ThemedText>

                <View style={styles.salaryInputWrapper}>
                  <ThemedText style={styles.salaryLabel}>$</ThemedText>
                  <TextInput
                    style={styles.salaryInput}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    value={monthlySalary}
                    onChangeText={setMonthlySalary}
                  />
                </View>

                <Pressable
                  style={[
                    styles.salaryButton,
                    !monthlySalary && styles.disabled,
                  ]}
                  disabled={!monthlySalary}
                  onPress={() => setSalaryEntered(true)}
                >
                  <ThemedText style={styles.salaryButtonText}>
                    Continuar →
                  </ThemedText>
                </Pressable>
              </Animated.View>
            </ThemedView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  /* ---------------- MODAL CATEGORÍAS ---------------- */

  if (salaryEntered && !categoriesConfirmed) {
    const INNER_SIZE = Math.min(140, ITEM_SIZE * 0.95);

    const renderModalTile = (item: any) => {
      const isSelected = selectedCategoriesForMonth.includes(item.id);
      const anim = initAnim(item.id);

      return (
        <Animated.View
          key={item.id}
          style={{ width: INNER_SIZE, height: INNER_SIZE, margin: 0.5, transform: [{ scale: anim }] }}
        >
          <Pressable
            onPress={() => toggleCategorySelection(item.id)}
            style={[
              styles.modalTile,
              {
                backgroundColor: isSelected ? '#E6F6FF' : '#FFFFFF',
                borderColor: isSelected ? '#0EA5FF' : '#E6EEF6',
              },
            ]}
          >
            <ThemedText style={[styles.icon, { color: isSelected ? '#075985' : '#0F172A' }]}>
              {item.icon}
            </ThemedText>
            <ThemedText style={[styles.label, { color: '#0F172A', marginTop: 6 }]} numberOfLines={2}>
              {item.name}
            </ThemedText>
          </Pressable>
        </Animated.View>
      );
    };

    return (
      <Modal visible transparent animationType="fade">
        <ThemedView style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.outerPanel,
              {
                transform: [{ scale: panelAnim }],
                opacity: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              },
            ]}
          >
            <Pressable style={styles.modalBackIcon} onPress={() => setSalaryEntered(false)}>
              <ThemedText style={styles.modalBackIconText}>←</ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.modalContinueIcon,
                selectedCategoriesForMonth.length === 0 && styles.disabled,
              ]}
              onPress={() => {
                if (selectedCategoriesForMonth.length > 0) setCategoriesConfirmed(true);
              }}
            >
              <ThemedText style={styles.modalContinueIconText}>✓</ThemedText>
            </Pressable>

            <ThemedText type="title" style={styles.modalTitle}>
              🎯 Configura tu mes
            </ThemedText>

            <View style={styles.innerBox}>
              <FlatList
                data={categories}
                key={`select-2`}
                numColumns={2}
                scrollEnabled={true}
                showsVerticalScrollIndicator={true}
                style={{ width: '100%', flex: 1 }}
                columnWrapperStyle={{ justifyContent: 'center', gap: 1 }}
                contentContainerStyle={{ alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 8, paddingHorizontal: 8 }}
                renderItem={({ item }) => renderModalTile(item)}
                keyExtractor={c => c.id}
              />
            </View>

            {/* buttons moved to top-right as compact icon */}
          </Animated.View>
        </ThemedView>
      </Modal>
    );
  }

  /* ---------------- PANTALLA PRESUPUESTO ---------------- */

  if (salaryEntered && categoriesConfirmed && !budgetDefined && !budgetAssigned) {
    const monthCats = categories.filter(c =>
      selectedCategoriesForMonth.includes(c.id)
    );

    return (
      <ThemedView style={styles.container}>
        <Animated.View style={styles.budgetBox}>
          {/* Back Icon */}
          <Pressable 
            style={styles.budgetBackIcon}
            onPress={() => {
              setCategoriesConfirmed(false);
              setSelectedCategoriesForMonth([]);
              setCategoryPrices({});
            }}
          >
            <ThemedText style={styles.budgetBackIconText}>←</ThemedText>
          </Pressable>

          {/* Continue Icon */}
          <Pressable 
            style={[styles.budgetContinueIcon, totalBudget === 0 && styles.disabled]}
            onPress={() => {
              if (totalBudget > 0) {
                setBudgetAssigned(true);
              }
            }}
            disabled={totalBudget === 0}
          >
            <ThemedText style={styles.budgetContinueIconText}>✓</ThemedText>
          </Pressable>

          <ThemedText type="title" style={styles.budgetPageTitle}>
            💼 Asigna Presupuestos
          </ThemedText>

          <View style={styles.budgetSalaryCard}>
            <ThemedText style={styles.budgetSalaryLabel}>Salario Mensual</ThemedText>
            <ThemedText style={styles.budgetSalaryValue}>
              ${Number(monthlySalary).toFixed(2)}
            </ThemedText>
          </View>

          <FlatList
            key={`budget-${numColumns}`}
            data={monthCats}
            numColumns={1}
            scrollEnabled={true}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16, gap: 10 }}
            keyExtractor={c => c.id}
            renderItem={({ item: cat }) => {
              const colors = CategoryColors[cat.name] || CategoryColors['Otros'];
              return (
                <View style={[styles.budgetCategoryItem, { backgroundColor: colors.bg }]}>
                  <ThemedText style={styles.budgetCategoryName}>{cat.name}</ThemedText>
                  <View style={styles.budgetCategoryInput}>
                    <ThemedText style={styles.budgetCategoryDollar}>$</ThemedText>
                    <TextInput
                      style={styles.budgetCategoryInputField}
                      placeholder="0.00"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="decimal-pad"
                      value={categoryPrices[cat.id] || ''}
                      onChangeText={(price) =>
                        updateCategoryPrice(cat.id, price)
                      }
                    />
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.budgetPageSummary}>
            <View style={styles.budgetPageSummaryRow}>
              <ThemedText style={styles.budgetPageSummaryLabel}>Total Presupuesto:</ThemedText>
              <ThemedText style={styles.budgetPageSummaryValue}>
                ${totalBudget.toFixed(2)}
              </ThemedText>
            </View>

            <View style={styles.budgetPageSummaryRow}>
              <ThemedText style={styles.budgetPageSummaryLabel}>Neto Disponible:</ThemedText>
              <ThemedText
                style={[
                  styles.budgetPageSummaryValue,
                  { color: netValue >= 0 ? '#10B981' : '#EF4444' },
                ]}
              >
                ${netValue.toFixed(2)}
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ThemedView>
    );
  }

  /* ---------------- PANTALLA GRÁFICO DE GASTOS ---------------- */

  if (budgetAssigned && !monthStarted) {
    const budgetItems = selectedCategoriesForMonth
      .map(catId => {
        const cat = categories.find(c => c.id === catId);
        const price = Number(categoryPrices[catId]) || 0;
        return { cat, price };
      })
      .filter(item => item.price > 0 && item.cat);

    const totalSpent = budgetItems.reduce((sum, item) => sum + item.price, 0);
    const netRemaining = Number(monthlySalary) - totalSpent;
    const salary = Number(monthlySalary);

    return (
      <ThemedView style={styles.container}>
        {/* Back Icon - Absoluto */}
        <Pressable 
          style={styles.budgetBackIcon}
          onPress={() => {
            setCategoriesConfirmed(false);
            setSelectedCategoriesForMonth([]);
            setCategoryPrices({});
            setBudgetAssigned(false);
          }}
        >
          <ThemedText style={styles.budgetBackIconText}>←</ThemedText>
        </Pressable>

        {/* Continue Icon - Absoluto */}
        <Pressable 
          style={styles.budgetContinueIcon}
          onPress={() => {
            setBudgetDefined(true);
            setMonthStarted(true);
          }}
        >
          <ThemedText style={styles.budgetContinueIconText}>✓</ThemedText>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.budgetBoxScroll}
          showsVerticalScrollIndicator={true}
        >
          <ThemedText type="title" style={styles.budgetPageTitle}>
            📊 Resumen de Gastos
          </ThemedText>

          {/* Gráfico circular mejorado */}
          <View style={styles.chartContainer}>
            {/* Pie chart visual usando SVG */}
            <Svg width={280} height={280} viewBox="0 0 280 280" style={{ marginBottom: 16 }}>
              {(() => {
                const SIZE = 280;
                const CENTER = SIZE / 2;
                const RADIUS = 100;
                const INNER_RADIUS = 60;
                let currentAngle = -90; // Empezar desde arriba

                return budgetItems.map((item, idx) => {
                  const percentage = (item.price / salary) * 100;
                  const angle = (percentage / 100) * 360;
                  const colors = CategoryColors[item.cat!.name] || CategoryColors['Otros'];
                  
                  // Calcular inicio y fin en radianes
                  const startRad = (currentAngle * Math.PI) / 180;
                  const endRad = ((currentAngle + angle) * Math.PI) / 180;
                  
                  // Coordenadas del arco exterior
                  const x1 = CENTER + RADIUS * Math.cos(startRad);
                  const y1 = CENTER + RADIUS * Math.sin(startRad);
                  const x2 = CENTER + RADIUS * Math.cos(endRad);
                  const y2 = CENTER + RADIUS * Math.sin(endRad);
                  
                  // Coordenadas del arco interior
                  const x3 = CENTER + INNER_RADIUS * Math.cos(endRad);
                  const y3 = CENTER + INNER_RADIUS * Math.sin(endRad);
                  const x4 = CENTER + INNER_RADIUS * Math.cos(startRad);
                  const y4 = CENTER + INNER_RADIUS * Math.sin(startRad);
                  
                  const largeArc = angle > 180 ? 1 : 0;
                  
                  const pathData = `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${x4} ${y4} Z`;
                  
                  currentAngle += angle;
                  
                  return (
                    <Path
                      key={`segment-${idx}`}
                      d={pathData}
                      fill={colors.bg}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                    />
                  );
                });
              })()}

              {/* Segmento para disponible si existe */}
              {netRemaining > 0 && (() => {
                const startAngle = budgetItems.reduce((sum, i) => sum + ((i.price / salary) * 100), 0);
                const percentage = (netRemaining / salary) * 100;
                const angle = (percentage / 100) * 360;
                
                const currentAngle = -90 + startAngle;
                const startRad = (currentAngle * Math.PI) / 180;
                const endRad = ((currentAngle + angle) * Math.PI) / 180;
                
                const CENTER = 140;
                const RADIUS = 100;
                const INNER_RADIUS = 60;
                
                const x1 = CENTER + RADIUS * Math.cos(startRad);
                const y1 = CENTER + RADIUS * Math.sin(startRad);
                const x2 = CENTER + RADIUS * Math.cos(endRad);
                const y2 = CENTER + RADIUS * Math.sin(endRad);
                
                const x3 = CENTER + INNER_RADIUS * Math.cos(endRad);
                const y3 = CENTER + INNER_RADIUS * Math.sin(endRad);
                const x4 = CENTER + INNER_RADIUS * Math.cos(startRad);
                const y4 = CENTER + INNER_RADIUS * Math.sin(startRad);
                
                const largeArc = angle > 180 ? 1 : 0;
                
                const pathData = `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${x4} ${y4} Z`;
                
                return (
                  <Path
                    key="segment-available"
                    d={pathData}
                    fill="#10B981"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1"
                  />
                );
              })()}

              {/* Centro con información */}
              <Circle cx={140} cy={140} r={55} fill="#FFFFFF" />
              <SvgText
                x={140}
                y={130}
                textAnchor="middle"
                fontSize="12"
                fill="#0EA5FF"
                fontWeight="700"
              >
                Total
              </SvgText>
              <SvgText
                x={140}
                y={155}
                textAnchor="middle"
                fontSize="20"
                fill="#0284C7"
                fontWeight="800"
              >
                ${salary.toFixed(0)}
              </SvgText>
            </Svg>
          </View>

          {/* Título de categorías */}
          <ThemedText type="default" style={styles.categoriesTitle}>
            💰 Categorías Asignadas
          </ThemedText>

          {/* Categorías con valores */}
          <View style={styles.categoriesContainer}>
            {budgetItems.map((item, idx) => {
              const percentage = ((item.price / salary) * 100).toFixed(1);
              const colors = CategoryColors[item.cat!.name] || CategoryColors['Otros'];

              return (
                <View 
                  key={`cat-${idx}`}
                  style={[
                    styles.categoryCard,
                    { borderLeftColor: colors.bg, backgroundColor: colors.bg + '15' }
                  ]}
                >
                  <View style={styles.categoryCardLeft}>
                    <ThemedText style={styles.categoryCardIcon}>
                      {item.cat!.icon}
                    </ThemedText>
                    <View style={styles.categoryCardInfo}>
                      <ThemedText style={styles.categoryCardName}>
                        {item.cat!.name}
                      </ThemedText>
                      <ThemedText style={styles.categoryCardPercent}>
                        {percentage}% del salario
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.categoryCardRight}>
                    <ThemedText style={[styles.categoryCardValue, { color: colors.bg }]}>
                      ${item.price.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}

            {/* Disponible */}
            {netRemaining > 0 && (
              <View 
                style={[
                  styles.categoryCard,
                  { borderLeftColor: '#10B981', backgroundColor: '#10B98115' }
                ]}
              >
                <View style={styles.categoryCardLeft}>
                  <ThemedText style={{ fontSize: 20, marginRight: 12 }}>
                    💚
                  </ThemedText>
                  <View style={styles.categoryCardInfo}>
                    <ThemedText style={styles.categoryCardName}>
                      Disponible
                    </ThemedText>
                    <ThemedText style={styles.categoryCardPercent}>
                      {((netRemaining / salary) * 100).toFixed(1)}% del salario
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.categoryCardRight}>
                  <ThemedText style={[styles.categoryCardValue, { color: '#10B981' }]}>
                    ${netRemaining.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>

          {/* Resumen mejorado con estadísticas */}
          <View style={styles.summaryBox}>
            {/* Fila 1: Salario y Gastos */}
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Salario Total:</ThemedText>
              <ThemedText style={styles.summaryValueGreen}>
                ${salary.toFixed(2)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Total Gastos:</ThemedText>
              <ThemedText style={styles.summaryValueOrange}>
                ${totalSpent.toFixed(2)}
              </ThemedText>
            </View>

            {/* Separador */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#00D9FF', marginVertical: 8 }} />

            {/* Fila 2: Disponible y Porcentaje */}
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Disponible:</ThemedText>
              <ThemedText
                style={[
                  styles.summaryValue,
                  { color: netRemaining >= 0 ? '#00FF88' : '#FF5454', fontWeight: '700' },
                ]}
              >
                ${netRemaining.toFixed(2)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>% Gastado:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#00D9FF' }]}>
                {totalSpent > 0 ? ((totalSpent / salary) * 100).toFixed(1) : '0.0'}%
              </ThemedText>
            </View>

            {/* Separador */}
            <View style={{ borderTopWidth: 1, borderTopColor: '#00D9FF', marginVertical: 8 }} />

            {/* Fila 3: Mayor presupuesto y promedio */}
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Mayor categoría:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#00D9FF', fontSize: 12 }]}>
                {budgetItems.length > 0
                  ? budgetItems.reduce((max, item) => (item.price > max.price ? item : max)).cat?.name
                  : 'N/A'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Prom. Categoría:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#00D9FF' }]}>
                ${budgetItems.length > 0 ? (totalSpent / budgetItems.length).toFixed(2) : '0.00'}
              </ThemedText>
            </View>
          </View>

          {/* Espacio para scroll bottom */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </ThemedView>
    );
  }

  /* ---------------- PANTALLA PRINCIPAL ---------------- */

  if (budgetDefined && !monthStarted) {
    setMonthStarted(true);
  }

  /* ---------------- MAIN ---------------- */

  return (
    <ThemedView style={[styles.container, { paddingHorizontal: padding }]}>
      <ThemedText type="title" style={{ color: balance >= 0 ? '#22C55E' : '#EF4444' }}>
        ${balance.toFixed(2)}
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Monto"
        placeholderTextColor="#64748B"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <FlatList
        key={`month-${numColumns}`}
        data={monthCategories}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP }}
        keyExtractor={c => c.id}
        scrollEnabled={false}
        renderItem={({ item }) =>
          renderCategoryItem(
            item,
            setSelectedCategory,
            selectedCategory === item.id
          )
        }
      />

      <Pressable
        style={[styles.saveButton, (!amount || !selectedCategory) && styles.disabled]}
        disabled={!amount || !selectedCategory}
        onPress={addTransaction}
      >
        <ThemedText style={styles.saveText}>Guardar</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItem: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6EEF6',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.0,
    borderRadius: 18,
  },
  icon: {
    fontSize: 34,
    marginBottom: 6,
    color: '#0F172A',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0F172A',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E6EEF6',
  },
  salaryInput: {
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    borderRadius: 14,
    padding: 16,
    fontSize: 28,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    textAlign: 'center',
    width: '70%',
    fontWeight: '700',
  },
  salaryLabel: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0EA5FF',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#0EA5FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salaryModalBox: {
    width: '90%',
    maxWidth: 920,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  salaryModalTitle: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
  },
  salaryModalSubtitle: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 32,
    fontSize: 16,
    fontWeight: '500',
  },
  salaryInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  salaryButton: {
    backgroundColor: '#0EA5FF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    width: '75%',
    shadowColor: '#0EA5FF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  salaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  modalSubtitle: {
    textAlign: 'center',
    color: '#475569',
    marginBottom: 12,
    fontSize: 14,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  modalButton: {
    backgroundColor: '#0EA5FF',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
    width: '60%',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  budgetBox: {
    width: '90%',
    height: '88%',
    maxWidth: 920,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  budgetBackIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  budgetBackIconText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  budgetContinueIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  budgetContinueIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  budgetPageTitle: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
  },
  budgetSalaryCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    width: '90%',
  },
  budgetSalaryLabel: {
    color: '#0369A1',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  budgetSalaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0284C7',
  },
  budgetItemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  budgetItemLeft: {
    flex: 0,
    width: 90,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.85,
  },
  budgetItemIcon: {
    fontSize: 32,
    marginBottom: 2,
  },
  budgetItemName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#fff',
  },
  budgetItemRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    height: 60,
    gap: 6,
  },
  budgetDollarSign: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0EA5FF',
  },
  budgetPriceInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  budgetCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '95%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    opacity: 0.9,
  },
  budgetCategoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  budgetCategoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    minWidth: 100,
  },
  budgetCategoryDollar: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  budgetCategoryInputField: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  budgetPageSummary: {
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#BAE6FD',
    width: '90%',
  },
  budgetPageSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  budgetPageSummaryLabel: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '600',
  },
  budgetPageSummaryValue: {
    color: '#0284C7',
    fontSize: 16,
    fontWeight: '800',
  },
  budgetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00D9FF',
    marginBottom: 16,
  },
  salaryCard: {
    backgroundColor: '#1A3A52',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00D9FF',
    alignItems: 'center',
  },
  salaryCardLabel: {
    color: '#7DD3FC',
    fontSize: 12,
    marginBottom: 4,
  },
  salaryCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FF88',
  },
  budgetItem: {
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceInput: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#fff',
    width: 60,
    textAlign: 'center',
  },
  budgetSummary: {
    backgroundColor: '#1A3A52',
    borderRadius: 14,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#00D9FF',
  },
  budgetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  budgetButton: {
    backgroundColor: '#0080FF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00D9FF',
  },
  budgetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#1A3A52',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7DD3FC',
  },
  backButtonText: {
    color: '#7DD3FC',
    fontSize: 16,
    fontWeight: '700',
  },
  chartContainer: {
    marginVertical: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  donutChart: {
    width: 280,
    height: 280,
    borderRadius: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#0EA5FF',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  pieSegment: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderRightWidth: 35,
    borderRightColor: 'transparent',
    borderBottomWidth: 35,
    borderBottomColor: 'transparent',
    borderLeftWidth: 35,
    borderLeftColor: 'transparent',
  },
  donutSegment: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderTopWidth: 25,
    borderTopColor: '#00D9FF',
    borderRightWidth: 25,
    borderRightColor: 'transparent',
    borderBottomWidth: 25,
    borderBottomColor: 'transparent',
    borderLeftWidth: 25,
    borderLeftColor: 'transparent',
  },
  ringContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringSegment: {
    position: 'absolute',
    borderRadius: 100,
    borderTopWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 12,
    borderLeftWidth: 12,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  pieSlice: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderTopWidth: 30,
    borderTopColor: '#00D9FF',
    borderRightWidth: 30,
    borderRightColor: 'transparent',
    borderBottomWidth: 30,
    borderBottomColor: 'transparent',
    borderLeftWidth: 30,
    borderLeftColor: 'transparent',
  },
  donutSegmentsContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  donutSegmentBar: {
    height: '100%',
  },
  donutCenter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#0EA5FF',
  },
  donutCenterLabel: {
    color: '#0369A1',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  donutCenterValue: {
    color: '#0284C7',
    fontSize: 22,
    fontWeight: '900',
  },
  headerChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A3A52',
    borderWidth: 2,
    borderColor: '#7DD3FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#7DD3FC',
    fontSize: 20,
    fontWeight: '700',
  },
  outerPanel: {
    width: '90%',
    height: '85%',
    maxWidth: 920,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBackIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackIconText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  modalContinueIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContinueIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  innerBox: {
    width: '100%',
    marginTop: 36,
    marginBottom: 8,
    paddingHorizontal: 8,
    flex: 1,
    justifyContent: 'center',
  },
  modalTile: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    aspectRatio: 1,
    width: '100%',
    height: '100%',
  },
  buttonContainerCentered: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
    width: '100%',
  },
  chartLegend: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1A3A52',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  legendColor: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginTop: 4,
  },
  legendItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendName: {
    color: '#F5F5F5',
    fontWeight: '700',
    fontSize: 13,
  },
  legendPercent: {
    color: '#00D9FF',
    fontWeight: '700',
    fontSize: 12,
  },
  legendBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  legendBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  legendPrice: {
    color: '#7DD3FC',
    fontSize: 11,
  },
  summaryBox: {
    backgroundColor: '#1A3A52',
    borderRadius: 14,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#00D9FF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  summaryLabel: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#00D9FF',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryValueGreen: {
    color: '#00FF88',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryValueOrange: {
    color: '#FFB800',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  budgetBoxScroll: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: 'center',
  },
  categoriesTitle: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  categoriesContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: '#F8FAFC',
  },
  categoryCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryCardIcon: {
    fontSize: 24,
  },
  categoryCardInfo: {
    flex: 1,
  },
  categoryCardName: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryCardPercent: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryCardRight: {
    alignItems: 'flex-end',
  },
  categoryCardValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});
