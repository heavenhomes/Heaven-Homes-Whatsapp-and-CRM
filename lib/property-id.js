// lib/property-id.js
export function generatePropertyId(city, area) {
  const cityCode = (city || 'XXX').substring(0, 3).toUpperCase();
  const areaCode = (area || 'YYY').substring(0, 3).toUpperCase();
  const randomNum = Math.floor(Math.random() * 9000 + 1000);
  return `${cityCode}${areaCode}${randomNum}`;
}

export async function generateUniquePropertyId(Property, city, area, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const id = generatePropertyId(city, area);
    if (!(await Property.findOne({ propertyId: id }))) return id;
  }
  // Fallback: append timestamp suffix
  return `${generatePropertyId(city, area)}${Date.now().toString().slice(-4)}`;
}