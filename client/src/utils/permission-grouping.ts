import type { Permission } from '../types/role';

export interface PermissionCategoryLabel {
  id: number;
  category_key: string;
  label_en: string;
  label_fr: string;
  created_at: string;
  updated_at: string;
}

export interface GroupedPermissions {
  categoryKey: string;
  displayLabel: string;
  permissions: Permission[];
}

/**
 * Group permissions by category and apply display labels
 *
 * @param permissions - Array of permissions to group
 * @param categoryLabels - Array of category labels from API
 * @param language - Display language ('en' or 'fr'), defaults to 'fr'
 * @returns Array of grouped permissions with display labels
 *
 * Fallback behavior:
 * - If a category has no label in categoryLabels, uses category_key as displayLabel
 * - Handles permissions with unknown categories gracefully
 */
export function groupPermissionsByCategory(
  permissions: Permission[],
  categoryLabels: PermissionCategoryLabel[],
  language: 'en' | 'fr' = 'fr'
): GroupedPermissions[] {
  // Build a map for quick label lookup
  const labelMap = new Map<string, PermissionCategoryLabel>();
  categoryLabels.forEach(label => {
    labelMap.set(label.category_key, label);
  });

  // Group permissions by category
  const groupedMap = new Map<string, Permission[]>();
  permissions.forEach(perm => {
    const category = perm.category;
    if (!groupedMap.has(category)) {
      groupedMap.set(category, []);
    }
    groupedMap.get(category)!.push(perm);
  });

  // Convert to result format
  const result: GroupedPermissions[] = [];
  groupedMap.forEach((perms, categoryKey) => {
    const label = labelMap.get(categoryKey);
    const displayLabel = label
      ? language === 'en'
        ? label.label_en
        : label.label_fr
      : categoryKey; // Fallback to category key if label not found

    result.push({
      categoryKey,
      displayLabel,
      permissions: perms,
    });
  });

  return result;
}
