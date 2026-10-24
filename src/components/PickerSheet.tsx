import React, { useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme';

export function PickerSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  testIDPrefix = 'picker',
}: {
  visible: boolean;
  title: string;
  options: string[];
  value?: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  testIDPrefix?: string;
}) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const translate = React.useMemo(() => new Animated.Value(400), []);

  useEffect(() => {
    Animated.timing(translate, {
      toValue: visible ? 0 : 400,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, translate]);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testIDPrefix}-backdrop`}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: translate }],
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              ...shadows.lg
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text, ...typography.title.medium, fontWeight: '700' }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              testID={`${testIDPrefix}-close`}
              style={[styles.closeButton, { backgroundColor: colors.surfaceTint }]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingBottom: spacing.xl }}>
              {options.map((opt) => {
                const selected = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.6}
                    onPress={() => {
                      onSelect(opt);
                      onClose();
                    }}
                    testID={`${testIDPrefix}-option-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                    style={[
                      styles.row,
                      { borderBottomColor: colors.border + '50' },
                      selected && { backgroundColor: colors.surfaceTint },
                    ]}
                  >
                    <Text style={[
                      styles.rowText,
                      {
                        color: selected ? colors.primary : colors.text,
                        ...typography.body.large,
                        fontWeight: selected ? '700' : '500'
                      }
                    ]}>
                      {opt}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  title: { },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  rowText: { },
});
