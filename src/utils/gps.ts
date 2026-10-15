export const REQUIRED_SAMPLES = 5;

export const averageCoords = (
  samples: { latitude: number; longitude: number }[],
) => {
  const total = samples.reduce(
    (acc, cur) => ({
      latitude: acc.latitude + cur.latitude,
      longitude: acc.longitude + cur.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / samples.length,
    longitude: total.longitude / samples.length,
  };
};
