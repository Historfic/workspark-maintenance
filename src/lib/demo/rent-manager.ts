// Stand-in for Rent Manager until API access arrives. Every name, phone number and address here is
// made up for the demo.

export interface DemoProperty {
  id: string;
  name: string;
  address: string;
}

export interface DemoTenant {
  name: string;
  unit: string;
  propertyId: string;
  phone: string;
}

export const DEMO_PROPERTIES: readonly DemoProperty[] = [
  { id: "P-101", name: "Maple Court", address: "120 Maple Ave" },
  { id: "P-102", name: "Riverside Lofts", address: "48 River St" },
];

const DEMO_TENANTS: readonly DemoTenant[] = [
  { name: "Maria Lopez", unit: "4B", propertyId: "P-101", phone: "(555) 010-2041" },
  { name: "James Carter", unit: "12C", propertyId: "P-102", phone: "(555) 010-3112" },
  { name: "Aisha Rahman", unit: "7A", propertyId: "P-101", phone: "(555) 010-4407" },
  { name: "Daniel Kim", unit: "2D", propertyId: "P-101", phone: "(555) 010-5023" },
  { name: "Sofia Rossi", unit: "3A", propertyId: "P-101", phone: "(555) 010-6630" },
  { name: "Noah Williams", unit: "5C", propertyId: "P-101", phone: "(555) 010-7215" },
  { name: "Grace Okafor", unit: "1B", propertyId: "P-102", phone: "(555) 010-8341" },
  { name: "Ethan Brooks", unit: "6D", propertyId: "P-102", phone: "(555) 010-9188" },
  { name: "Lena Fischer", unit: "8A", propertyId: "P-102", phone: "(555) 011-0274" },
  { name: "Omar Haddad", unit: "10B", propertyId: "P-102", phone: "(555) 011-1350" },
  { name: "Chloe Martin", unit: "11A", propertyId: "P-102", phone: "(555) 011-2466" },
  { name: "Lucas Silva", unit: "9C", propertyId: "P-101", phone: "(555) 011-3592" },
  { name: "Priya Patel", unit: "10A", propertyId: "P-102", phone: "(555) 011-4618" },
  { name: "Marcus Bell", unit: "11D", propertyId: "P-102", phone: "(555) 011-5724" },
  { name: "Hannah Cohen", unit: "12B", propertyId: "P-102", phone: "(555) 011-6830" },
  { name: "Diego Alvarez", unit: "2C", propertyId: "P-101", phone: "(555) 011-7946" },
  { name: "Emily Zhang", unit: "3B", propertyId: "P-101", phone: "(555) 011-8052" },
  { name: "Samuel Osei", unit: "3F", propertyId: "P-101", phone: "(555) 011-9168" },
  { name: "Rachel Green", unit: "3Z", propertyId: "P-101", phone: "(555) 012-0274" },
  { name: "Victor Petrov", unit: "4F", propertyId: "P-101", phone: "(555) 012-1380" },
  { name: "Nadia Hassan", unit: "4J", propertyId: "P-101", phone: "(555) 012-2496" },
  { name: "Ben Turner", unit: "5B", propertyId: "P-101", phone: "(555) 012-3502" },
  { name: "Isabel Reyes", unit: "5D", propertyId: "P-101", phone: "(555) 012-4618" },
  { name: "Kenji Watanabe", unit: "6A", propertyId: "P-102", phone: "(555) 012-5724" },
  { name: "Olivia Dubois", unit: "8E", propertyId: "P-102", phone: "(555) 012-6830" },
  { name: "Tariq Ahmed", unit: "9A", propertyId: "P-101", phone: "(555) 012-7946" },
];

export function findTenant(unit: string | null): DemoTenant | null {
  const wanted = unit?.trim().toUpperCase();
  if (!wanted) return null;
  return DEMO_TENANTS.find((tenant) => tenant.unit === wanted) ?? null;
}

export function propertyOf(tenant: DemoTenant): DemoProperty | undefined {
  return DEMO_PROPERTIES.find((property) => property.id === tenant.propertyId);
}

export function tenantsOf(propertyId: string): DemoTenant[] {
  return DEMO_TENANTS.filter((tenant) => tenant.propertyId === propertyId);
}

export function rmTicketNumber(workOrderId: string): string {
  let hash = 0;
  for (const char of workOrderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `SI-${1000 + (hash % 9000)}`;
}
