import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
};

export default function AppButton({ title, icon, theme, onPress }: Props) {
  if (theme === 'primary') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.buttonInner,
          styles.primaryFill,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
      >
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.textOnPrimary}
          style={styles.icon}
        />
        <Text style={[styles.label, styles.primaryLabel]}>
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.buttonInner,
        styles.secondaryFill,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.textSecondary}
        style={styles.icon}
      />
      <Text style={[styles.label, styles.secondaryLabel]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonInner: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryFill: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryFill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    paddingRight: 8,
  },
  label: {
    fontSize: 16,
  },
  primaryLabel: {
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  secondaryLabel: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});