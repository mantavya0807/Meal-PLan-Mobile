/**
 * Tab Layout with Menu Navigation
 * File Path: app/(tabs)/_layout.tsx
 * 
 * Bottom tab navigation with Dashboard, Menu, and Transactions tabs
 * following the existing theme system and design patterns.
 */

import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

/**
 * Tab bar icon component with proper typing
 */
const TabIcon: React.FC<{ name: string; color: string; focused: boolean }> = ({ name, color, focused }) => {
  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (name) {
      case 'dashboard':
        return focused ? 'grid' : 'grid-outline';
      case 'menu':
        return focused ? 'restaurant' : 'restaurant-outline';
      case 'transactions':
        return focused ? 'card' : 'card-outline';
      default:
        return 'help-outline';
    }
  };

  return <Ionicons name={getIconName()} size={24} color={color} />;
};

/**
 * Main tab layout component
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderLight,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          ...theme.shadows.lg,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.sizes.xs,
          fontWeight: theme.typography.weights.medium,
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderLight,
          borderBottomWidth: 1,
          ...theme.shadows.sm,
        },
        headerTitleStyle: {
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.textPrimary,
        },
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          headerTitle: 'Meal Plan Manager',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="dashboard" color={color} focused={focused} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          headerTitle: 'Today\'s Dining Menu',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="menu" color={color} focused={focused} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          headerTitle: 'Transaction History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="transactions" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}