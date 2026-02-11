import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';

type Item = {
  value: number;
  color: string;
};

interface FinanceDonutChartProps {
  size?: number;
  strokeWidth?: number;
  data: Item[];
}

export default function FinanceDonutChart({
  size = 220,
  strokeWidth = 26,
  data,
}: FinanceDonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <View>
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const percent = item.value;
          const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -cumulative;
          cumulative += (percent / 100) * circumference;

          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
      </Svg>
    </View>
  );
}
