import { describe, it, expect } from 'vitest';
import { groupPermissionsByCategory } from './permission-grouping';
import type { Permission, PermissionCategoryLabel } from '../types/role';

describe('groupPermissionsByCategory', () => {
  const mockPermissions: Permission[] = [
    {
      id: 1,
      name: 'users:list',
      description: 'List users',
      category: 'users',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'users:create',
      description: 'Create users',
      category: 'users',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 3,
      name: 'roles:list',
      description: 'List roles',
      category: 'roles',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 4,
      name: 'scraper:trigger',
      description: 'Trigger scraper',
      category: 'scraper',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockCategoryLabels: PermissionCategoryLabel[] = [
    {
      id: 1,
      category_key: 'users',
      label_en: 'Users',
      label_fr: 'Utilisateurs',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      category_key: 'roles',
      label_en: 'Roles',
      label_fr: 'Rôles',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 3,
      category_key: 'scraper',
      label_en: 'Scraping',
      label_fr: 'Scraping',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('groups permissions by category', () => {
    const result = groupPermissionsByCategory(mockPermissions, mockCategoryLabels, 'en');

    expect(result).toHaveLength(3);
    expect(result[0].categoryKey).toBe('users');
    expect(result[0].permissions).toHaveLength(2);
    expect(result[1].categoryKey).toBe('roles');
    expect(result[1].permissions).toHaveLength(1);
    expect(result[2].categoryKey).toBe('scraper');
    expect(result[2].permissions).toHaveLength(1);
  });

  it('uses English labels when language is "en"', () => {
    const result = groupPermissionsByCategory(mockPermissions, mockCategoryLabels, 'en');

    expect(result[0].displayLabel).toBe('Users');
    expect(result[1].displayLabel).toBe('Roles');
    expect(result[2].displayLabel).toBe('Scraping');
  });

  it('uses French labels when language is "fr"', () => {
    const result = groupPermissionsByCategory(mockPermissions, mockCategoryLabels, 'fr');

    expect(result[0].displayLabel).toBe('Utilisateurs');
    expect(result[1].displayLabel).toBe('Rôles');
    expect(result[2].displayLabel).toBe('Scraping');
  });

  it('defaults to French when language is not specified', () => {
    const result = groupPermissionsByCategory(mockPermissions, mockCategoryLabels);

    expect(result[0].displayLabel).toBe('Utilisateurs');
    expect(result[1].displayLabel).toBe('Rôles');
  });

  it('falls back to category key if label not found', () => {
    const result = groupPermissionsByCategory(
      mockPermissions,
      [], // No category labels
      'en'
    );

    expect(result).toHaveLength(3);
    expect(result[0].displayLabel).toBe('users');
    expect(result[1].displayLabel).toBe('roles');
    expect(result[2].displayLabel).toBe('scraper');
  });

  it('handles permissions with unknown categories', () => {
    const permsWithUnknown: Permission[] = [
      ...mockPermissions,
      {
        id: 5,
        name: 'unknown:action',
        description: 'Unknown permission',
        category: 'unknown_category',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const result = groupPermissionsByCategory(permsWithUnknown, mockCategoryLabels, 'en');

    expect(result).toHaveLength(4);
    const unknownGroup = result.find((group: any) => group.categoryKey === 'unknown_category');
    expect(unknownGroup).toBeDefined();
    expect(unknownGroup?.displayLabel).toBe('unknown_category'); // Fallback to key
    expect(unknownGroup?.permissions).toHaveLength(1);
  });

  it('returns empty array when no permissions are provided', () => {
    const result = groupPermissionsByCategory([], mockCategoryLabels, 'en');
    expect(result).toHaveLength(0);
  });

  it('maintains permission order within each group', () => {
    const result = groupPermissionsByCategory(mockPermissions, mockCategoryLabels, 'en');

    const usersGroup = result.find((group: any) => group.categoryKey === 'users');
    expect(usersGroup?.permissions[0].id).toBe(1);
    expect(usersGroup?.permissions[1].id).toBe(2);
  });

  it('includes duplicate permission objects in the array', () => {
    const dupePerms: Permission[] = [
      mockPermissions[0],
      mockPermissions[0], // duplicate object reference
      mockPermissions[1],
    ];

    const result = groupPermissionsByCategory(dupePerms, mockCategoryLabels, 'en');

    const usersGroup = result.find((group: any) => group.categoryKey === 'users');
    // Note: duplicates ARE included because we just iterate and push
    expect(usersGroup?.permissions).toHaveLength(3);
  });
});
