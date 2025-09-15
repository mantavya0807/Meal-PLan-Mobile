/**
 * Menu Location Tabs Component
 * File Path: components/MenuLocationTabs.tsx
 * 
 * Horizontal scrollable tabs for selecting Penn State dining locations
 * with modern design and smooth animations.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

/**
 * Menu location interface
 */
interface MenuLocation {
  id: string;
  locationId: number;
  name: string;
  shortName: string;
}

/**
 * Component props interface
 */
interface MenuLocationTabsProps {
  locations: MenuLocation[];
  selectedLocationId: string | null;
  onLocationChange: (locationId: string | null) => void;
  style?: ViewStyle;
  showAllTab?: boolean;
}

/**
 * Location emoji mapping based on location names
 */
const getLocationEmoji = (locationName: string): string => {
  const name = locationName.toLowerCase();
  
  if (name.includes('east') || name.includes('findlay')) return '🌅';
  if (name.includes('north') || name.includes('warnock')) return '🏔️';
  if (name.includes('pollock')) return '🏛️';
  if (name.includes('south') || name.includes('redifer')) return '🌻';
  if (name.includes('west') || name.includes('waring')) return '🌇';
  
  return '🏢'; // Default building emoji
};

/**
 * Gets a shortened version of location name
 */
const getDisplayName = (location: MenuLocation): string => {
  // Use shortName if available, otherwise create one
  if (location.shortName && location.shortName !== location.name) {
    return location.shortName;
  }
  
  // Extract key parts from full name
  const name = location.name;
  if (name.includes('East') && name.includes('Findlay')) return 'East @ Findlay';
  if (name.includes('North') && name.includes('Warnock')) return 'North @ Warnock';
  if (name.includes('Pollock')) return 'Pollock Commons';
  if (name.includes('South') && name.includes('Redifer')) return 'South @ Redifer';
  if (name.includes('West') && name.includes('Waring')) return 'West @ Waring';
  
  // Fallback: use first few words
  return name.split(' ').slice(0, 3).join(' ');
};

/**
 * Menu location tabs component
 */
const MenuLocationTabs: React.FC<MenuLocationTabsProps> = memo(({
  locations,
  selectedLocationId,
  onLocationChange,
  style,
  showAllTab = true,
}) => {
  
  /**
   * Handles location selection
   * @param locationId - Selected location ID (null for "All")
   */
  const handleLocationPress = (locationId: string | null) => {
    // Add haptic feedback if available
    try {
      const { Haptics } = require('expo-haptics');
      Haptics.selectionAsync();
    } catch (error) {
      // Haptics not available, ignore
    }
    
    onLocationChange(locationId);
  };

  if (locations.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* "All Locations" tab */}
        {showAllTab && (
          <TouchableOpacity
            style={[
              styles.locationTab,
              selectedLocationId === null && styles.locationTabSelected,
              styles.firstTab,
            ]}
            onPress={() => handleLocationPress(null)}
            activeOpacity={0.7}
          >
            {selectedLocationId === null && (
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryLight]}
                style={styles.selectedBackground}
              />
            )}
            
            <View style={styles.tabContent}>
              <Text style={styles.tabEmoji}>🎯</Text>
              <Text style={[
                styles.tabLabel,
                selectedLocationId === null ? styles.tabLabelSelected : styles.tabLabelUnselected,
              ]}>
                All Locations
              </Text>
              <Text style={[
                styles.tabSubLabel,
                selectedLocationId === null ? styles.tabSubLabelSelected : styles.tabSubLabelUnselected,
              ]}>
                {locations.length} dining halls
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Location tabs */}
        {locations.map((location, index) => {
          const isSelected = location.id === selectedLocationId;
          const displayName = getDisplayName(location);
          const emoji = getLocationEmoji(location.name);
          const isLast = index === locations.length - 1;
          
          return (
            <TouchableOpacity
              key={location.id}
              style={[
                styles.locationTab,
                isSelected && styles.locationTabSelected,
                isLast && styles.lastTab,
              ]}
              onPress={() => handleLocationPress(location.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryLight]}
                  style={styles.selectedBackground}
                />
              )}
              
              <View style={styles.tabContent}>
                <Text style={styles.tabEmoji}>{emoji}</Text>
                <Text style={[
                  styles.tabLabel,
                  isSelected ? styles.tabLabelSelected : styles.tabLabelUnselected,
                ]}>
                  {displayName}
                </Text>
                <Text style={[
                  styles.tabSubLabel,
                  isSelected ? styles.tabSubLabelSelected : styles.tabSubLabelUnselected,
                ]}>
                  Dining Hall
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      {/* Selection indicator */}
      <View style={styles.indicatorContainer}>
        <Text style={styles.indicatorText}>
          {selectedLocationId === null 
            ? `Showing all ${locations.length} locations`
            : `Showing ${locations.find(loc => loc.id === selectedLocationId)?.shortName || 'location'}`
          }
        </Text>
      </View>
    </View>
  );
});

MenuLocationTabs.displayName = 'MenuLocationTabs';

/**
 * Component styles
 */
const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },

  scrollView: {
    flexGrow: 0,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },

  locationTab: {
    position: 'relative',
    marginRight: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },

  firstTab: {
    marginLeft: 0,
  },

  lastTab: {
    marginRight: 0,
  },

  locationTabSelected: {
    elevation: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  selectedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.xl,
  },

  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabEmoji: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },

  tabLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    marginBottom: 2,
  },

  tabLabelSelected: {
  color: theme.colors.textInverse,
  },

  tabLabelUnselected: {
    color: theme.colors.textPrimary,
  },

  tabSubLabel: {
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
  },

  tabSubLabelSelected: {
  color: theme.colors.textInverse,
    opacity: 0.9,
  },

  tabSubLabelUnselected: {
    color: theme.colors.textSecondary,
  },

  indicatorContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },

  indicatorText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default MenuLocationTabs;