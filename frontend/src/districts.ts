export const DISTRICTS: Array<{ key: string; name: string }> = [
  { key: "east-jaintia-hills", name: "East Jaintia Hills" },
  { key: "east-khasi-hills", name: "East Khasi Hills" },
  { key: "east-garo-hills", name: "East Garo Hills" },
  { key: "eastern-west-khasi-hills", name: "Eastern West Khasi Hills" },
  { key: "north-garo-hills", name: "North Garo Hills" },
  { key: "ri-bhoi", name: "Ri Bhoi" },
  { key: "south-garo-hills", name: "South Garo Hills" },
  { key: "south-west-garo-hills", name: "South West Garo Hills" },
  { key: "south-west-khasi-hills", name: "South West Khasi Hills" },
  { key: "west-garo-hills", name: "West Garo Hills" },
  { key: "west-jaintia-hills", name: "West Jaintia Hills" },
  { key: "west-khasi-hills", name: "West Khasi Hills" },
];

export function districtName(key: string): string {
  return DISTRICTS.find((d) => d.key === key)?.name || key;
}
