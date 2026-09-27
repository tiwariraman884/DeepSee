export const pollutionTrend30d = Array.from({ length: 30 }, (_, i) => {
  const base = 58 + Math.sin(i / 4) * 6 - i * 0.2;
  return {
    day: i + 1,
    label: `D${i + 1}`,
    pollution: Math.max(40, Math.round(base + (i % 5) * 1.5)),
    biodiversity: Math.max(50, Math.round(64 + Math.cos(i / 5) * 4)),
  };
});
