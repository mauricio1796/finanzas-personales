import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { SwipeableRow } from '../components/ui/SwipeableRow';

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
type Filtro = 'todos' | 'ingresos' | 'gastos';

export const HistorialScreen: React.FC = () => {
  const { transactions, categories, deleteTransaction } = useFinance();
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filtered = useMemo(() => {
    let txs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filtro === 'ingresos') txs = txs.filter(t => t.type === 'income');
    if (filtro === 'gastos') txs = txs.filter(t => t.type === 'expense');
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      txs = txs.filter(t => t.category.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || fmtCOP(t.amount).includes(q));
    }
    return txs;
  }, [transactions, filtro, busqueda]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(tx => { const d = tx.date.slice(0, 10); if (!map.has(d)) map.set(d, []); map.get(d)!.push(tx); });
    return Array.from(map.entries());
  }, [filtered]);

  const totalIncome  = useMemo(() => filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);
  const balance = totalIncome - totalExpense;

  const getCatLabel = (id: string) => {
    const c = (categories as any[]).find((x: any) => x.id === id);
    return c ? (c.icon ? c.icon + ' ' : '') + c.name : id.charAt(0).toUpperCase() + id.slice(1);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerLabel}>ACTIVIDAD</Text>
        <Text style={s.headerTitle}>Historial</Text>
      </View>
      <View style={s.statsStrip}>
        <View style={s.statItem}><Text style={s.statVal}>{transactions.length}</Text><Text style={s.statLbl}>Total</Text></View>
        <View style={s.statDiv}/>
        <View style={s.statItem}><Text style={[s.statVal,{color:'#10B981'}]}>+{fmtCOP(totalIncome)}</Text><Text style={s.statLbl}>Ingresos</Text></View>
        <View style={s.statDiv}/>
        <View style={s.statItem}><Text style={[s.statVal,{color:'#EF4444'}]}>-{fmtCOP(totalExpense)}</Text><Text style={s.statLbl}>Gastos</Text></View>
        <View style={s.statDiv}/>
        <View style={s.statItem}>
          <Text style={[s.statVal,{color:balance>=0?'#6366F1':'#EF4444'}]}>{balance>=0?'+':''}{fmtCOP(balance)}</Text>
          <Text style={s.statLbl}>Balance</Text>
        </View>
      </View>
      <View style={[s.searchRow,searchFocused&&s.searchRowFocused]}>
        <Text style={s.searchIcon}>ð</Text>
        <TextInput style={s.searchInput} placeholder='Buscar por categoria, descripcion...' placeholderTextColor='#9CA3AF' value={busqueda} onChangeText={setBusqueda} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
        {busqueda.length>0&&(<TouchableOpacity onPress={()=>setBusqueda('')}><Text style={s.clearBtn}>â</Text></TouchableOpacity>)}
      </View>
      <View style={s.filterRow}>
        {(['todos','ingresos','gastos'] as Filtro[]).map(f=>(
          <TouchableOpacity key={f} style={[s.pill,filtro===f&&s.pillActive]} onPress={()=>setFiltro(f)}>
            <Text style={[s.pillText,filtro===f&&s.pillTextActive]}>{f==='todos'?'Todos':f==='ingresos'?'Ingresos':'Gastos'}</Text>
          </TouchableOpacity>
        ))}
        <View style={{flex:1}}/>
        <Text style={s.countLabel}>{filtered.length} resultados</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
        {grouped.length===0?(
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>ð­</Text>
            <Text style={s.emptyTitle}>Sin movimientos</Text>
            <Text style={s.emptySub}>{busqueda?'Sin resultados':'Registra ingresos o gastos para verlos aqui'}</Text>
          </View>
        ):(
          grouped.map(([day,txs])=>{
            const dn=txs.reduce((sum,t)=>sum+(t.type==='income'?t.amount:-t.amount),0);
            return (
              <View key={day} style={s.dayGroup}>
                <View style={s.dayHeader}>
                  <View style={s.dayDot}/>
                  <Text style={s.dayLabel}>{fmtFecha(day+'T12:00:00')}</Text>
                  <View style={s.dayLine}/>
                  <Text style={[s.dayNet,{color:dn>=0?'#10B981':'#EF4444'}]}>{dn>=0?'+':''}{fmtCOP(dn)}</Text>
                </View>
                <View style={s.card}>
                  {txs.map((tx,i)=>{
                    const inc=tx.type==='income';
                    return (
                      <SwipeableRow key={tx.id} onDelete={()=>deleteTransaction(tx.id)}>
                        <View style={[s.txRow,i<txs.length-1&&s.txBorder]}>
                          <View style={[s.txDot,{backgroundColor:inc?'#DCFCE7':'#FEE2E2'}]}>
                            <Text style={[s.txSign,{color:inc?'#10B981':'#EF4444'}]}>{inc?'+':'-'}</Text>
                          </View>
                          <View style={s.txInfo}>
                            <Text style={s.txCat}>{getCatLabel(tx.category)}</Text>
                            {tx.description?<Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>:null}
                            <Text style={s.txTime}>{fmtHora(tx.date)}</Text>
                          </View>
                          <View style={s.txRight}>
                            <Text style={[s.txAmt,{color:inc?'#10B981':'#EF4444'}]}>{inc?'+':'-'}{fmtCOP(tx.amount)}</Text>
                            <View style={[s.badge,{backgroundColor:inc?'#ECFDF5':'#FEF2F2'}]}>
                              <Text style={[s.badgeText,{color:inc?'#10B981':'#EF4444'}]}>{inc?'Ingreso':'Gasto'}</Text>
                            </View>
                          </View>
                        </View>
                      </SwipeableRow>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
        <View style={{height:40}}/>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F8FAFC'},
  header:{paddingHorizontal:20,paddingTop:12,paddingBottom:8},
  headerLabel:{fontSize:11,fontWeight:'700',color:'#9CA3AF',letterSpacing:1.2,textTransform:'uppercase' as any},
  headerTitle:{fontSize:26,fontWeight:'900',color:'#111827',marginTop:2},
  statsStrip:{flexDirection:'row',alignItems:'center',marginHorizontal:20,marginBottom:14,backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:'#E5E7EB',paddingVertical:12,paddingHorizontal:8},
  statItem:{flex:1,alignItems:'center'},
  statVal:{fontSize:13,fontWeight:'800',color:'#111827'},
  statLbl:{fontSize:10,color:'#9CA3AF',fontWeight:'600',marginTop:2},
  statDiv:{width:1,height:28,backgroundColor:'#E5E7EB'},
  searchRow:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:20,marginBottom:10,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#E5E7EB',paddingHorizontal:14,paddingVertical:11},
  searchRowFocused:{borderColor:'#6366F1',borderWidth:2},
  searchIcon:{fontSize:15},
  searchInput:{flex:1,fontSize:14,color:'#111827',padding:0},
  clearBtn:{fontSize:14,color:'#9CA3AF',paddingHorizontal:4},
  filterRow:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,marginBottom:10},
  pill:{paddingHorizontal:13,paddingVertical:6,borderRadius:20,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E5E7EB'},
  pillActive:{backgroundColor:'#6366F1',borderColor:'#6366F1'},
  pillText:{fontSize:13,fontWeight:'600',color:'#6B7280'},
  pillTextActive:{color:'#FFFFFF'},
  countLabel:{fontSize:11,color:'#9CA3AF',fontWeight:'600'},
  scroll:{flex:1},
  scrollContent:{paddingHorizontal:16,paddingTop:4,paddingBottom:16},
  dayGroup:{marginBottom:16},
  dayHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  dayDot:{width:8,height:8,borderRadius:4,backgroundColor:'#6366F1'},
  dayLabel:{fontSize:12,fontWeight:'700',color:'#6B7280',textTransform:'capitalize' as any},
  dayLine:{flex:1,height:1,backgroundColor:'#E5E7EB'},
  dayNet:{fontSize:12,fontWeight:'800'},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:'#E5E7EB'},
  txRow:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:13,gap:12},
  txBorder:{borderBottomWidth:1,borderBottomColor:'#F3F4F6'},
  txDot:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',flexShrink:0},
  txSign:{fontSize:22,fontWeight:'900'},
  txInfo:{flex:1,gap:2},
  txCat:{fontSize:14,fontWeight:'700',color:'#111827'},
  txDesc:{fontSize:12,color:'#6B7280'},
  txTime:{fontSize:11,color:'#9CA3AF'},
  txRight:{alignItems:'flex-end',gap:4},
  txAmt:{fontSize:15,fontWeight:'800'},
  badge:{paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  badgeText:{fontSize:10,fontWeight:'700'},
  empty:{alignItems:'center',paddingTop:64,gap:8},
  emptyEmoji:{fontSize:52,marginBottom:8},
  emptyTitle:{fontSize:17,fontWeight:'800',color:'#374151'},
  emptySub:{fontSize:14,color:'#9CA3AF',textAlign:'center' as any,lineHeight:20,paddingHorizontal:32},
});
