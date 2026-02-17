import React from 'react';
import { Button, TextInput, ActivityIndicator, Snackbar, Text } from 'react-native-paper';
import { StyleSheet, View, ViewProps } from 'react-native';
import { lightColors } from '../../theme/theme';

// Button Component
interface CustomButtonProps {
  onPress: () => void;
  label: string;
  variant?: 'contained' | 'outlined' | 'text';
  loading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'error' | 'success';
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  onPress,
  label,
  variant = 'contained',
  loading = false,
  disabled = false,
  size = 'medium',
  color = 'primary',
}) => {
  const mode = variant === 'contained' ? 'contained' : variant === 'outlined' ? 'outlined' : 'text';
  const buttonColor =
    color === 'primary'
      ? lightColors.primary
      : color === 'secondary'
      ? lightColors.secondary
      : color === 'error'
      ? lightColors.error
      : lightColors.success;

  const paddingMap = {
    small: { paddingVertical: 8, paddingHorizontal: 16 },
    medium: { paddingVertical: 12, paddingHorizontal: 24 },
    large: { paddingVertical: 16, paddingHorizontal: 32 },
  };

  return (
    <Button
      mode={mode}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      textColor={mode === 'contained' ? lightColors.surface : buttonColor}
      style={[styles.button, paddingMap[size]]}
      buttonColor={mode === 'contained' ? buttonColor : undefined}
    >
      {label}
    </Button>
  );
};

// Text Input Component
interface CustomTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}

export const CustomTextInput: React.FC<CustomTextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
}) => {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        disabled={disabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={styles.input}
        mode="outlined"
        outlineColor={lightColors.border}
        activeOutlineColor={lightColors.primary}
        textColor={lightColors.text}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// Card Component
interface CardProps extends ViewProps {
  children: React.ReactNode;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style, ...props }) => {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
};

// Badge Component
interface BadgeProps {
  label: string;
  color?: 'primary' | 'secondary' | 'error' | 'success' | 'warning';
  size?: 'small' | 'medium';
}

export const Badge: React.FC<BadgeProps> = ({ label, color = 'primary', size = 'medium' }) => {
  const colorMap = {
    primary: lightColors.primary,
    secondary: lightColors.secondary,
    error: lightColors.error,
    success: lightColors.success,
    warning: lightColors.warning,
  };

  const sizeStyle = size === 'small' ? styles.badgeSmall : styles.badgeMedium;

  return (
    <View style={[styles.badge, { backgroundColor: colorMap[color] }, sizeStyle]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
};

// Loading Spinner Component
interface LoadingProps {
  size?: 'small' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({ size = 'large' }) => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator animating={true} size={size} color={lightColors.primary} />
    </View>
  );
};

// Section Header Component
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action }) => {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {!!action && (
        <CustomButton label={action.label} onPress={action.onPress} variant="text" size="small" />
      )}
    </View>
  );
};

// Divider Component
export const Divider: React.FC = () => <View style={styles.divider} />;

// Empty State Component
interface EmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, action }) => {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateMessage}>{message}</Text>
      {action && <CustomButton label={action.label} onPress={action.onPress} />}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    marginVertical: 4,
  },
  inputContainer: {
    marginVertical: 8,
  },
  input: {
    backgroundColor: lightColors.surface,
  },
  errorText: {
    color: lightColors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 8,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: lightColors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: lightColors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: lightColors.border,
    marginVertical: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: lightColors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
});

// Alias for backward compatibility
export const LoadingSpinner = Loading;
