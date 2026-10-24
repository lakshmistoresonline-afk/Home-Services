import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTheme } from '@/src/theme';
import {
  type TimelineActivity,
  type TimelineActivityType,
  type TimelineAttachment
} from '@/src/api/client';

const { width } = Dimensions.get('window');

interface TimelineProps {
  timeline: TimelineActivity[];
  onAttachmentPress?: (attachment: TimelineAttachment) => void;
}

export function Timeline({ timeline, onAttachmentPress }: TimelineProps) {
  const { colors } = useTheme();

  // Group by date
  const groups: Record<string, TimelineActivity[]> = {};
  [...timeline].reverse().forEach(item => {
    const date = dayjs(item.timestamp).format('DD MMM YYYY');
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });

  const getIcon = (type: TimelineActivityType) => {
    switch (type) {
      case 'COMPLAINT_CREATED': return 'add-circle';
      case 'COMPLAINT_ASSIGNED':
      case 'COMPLAINT_REASSIGNED': return 'person-add';
      case 'ASSIGNMENT_ACCEPTED': return 'checkmark-done-circle';
      case 'ASSIGNMENT_REJECTED': return 'close-circle';
      case 'WORK_STARTED': return 'play-circle';
      case 'PROGRESS_UPDATED': return 'trending-up';
      case 'COMMENT_ADDED': return 'chatbubble-ellipses';
      case 'PHOTO_UPLOADED': return 'camera';
      case 'COMPLAINT_RESOLVED': return 'ribbon';
      case 'COMPLAINT_VERIFIED': return 'shield-checkmark';
      case 'COMPLAINT_CLOSED': return 'lock-closed';
      case 'COMPLAINT_REOPENED': return 'refresh-circle';
      case 'COMPLAINT_CANCELLED': return 'ban';
      default: return 'ellipse-outline';
    }
  };

  const getIconColor = (type: TimelineActivityType) => {
    if (type.includes('RESOLVED') || type.includes('VERIFIED')) return '#10B981';
    if (type.includes('CANCELLED') || type.includes('REJECTED')) return '#EF4444';
    if (type.includes('ASSIGNED')) return colors.primary;
    if (type === 'COMMENT_ADDED') return '#6366F1';
    return colors.textSecondary;
  };

  return (
    <View style={styles.container}>
      {Object.entries(groups).map(([date, items]) => (
        <View key={date} style={styles.dateGroup}>
          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>{date.toUpperCase()}</Text>
          </View>

          {items.map((item, idx) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.leftCol}>
                <View style={[styles.iconWrap, { backgroundColor: getIconColor(item.type) + '15' }]}>
                  <Ionicons name={getIcon(item.type) as any} size={18} color={getIconColor(item.type)} />
                </View>
                {idx !== items.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
              </View>

              <View style={styles.contentCol}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.itemTime, { color: colors.textSecondary }]}>{dayjs(item.timestamp).format('h:mm A')}</Text>
                </View>

                <View style={styles.actorRow}>
                  <Text style={[styles.actorName, { color: colors.primary }]}>{item.performedByName}</Text>
                  <View style={[styles.roleTag, { backgroundColor: colors.surfaceTint }]}>
                    <Text style={[styles.roleText, { color: colors.textSecondary }]}>{item.performedByRole.toUpperCase()}</Text>
                  </View>
                </View>

                {item.remarks ? (
                  <ExpandableText text={item.remarks} color={colors.text} />
                ) : null}

                {item.attachments && item.attachments.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentRow}>
                    {item.attachments.map(att => (
                      <TouchableOpacity key={att.id} onPress={() => onAttachmentPress?.(att)}>
                        <Image source={{ uri: att.url }} style={styles.attachmentThumb} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ExpandableText({ text, color }: { text: string, color: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => isLong && setExpanded(!expanded)}>
      <Text style={[styles.remarks, { color }]} numberOfLines={expanded ? undefined : 3}>
        {text}
      </Text>
      {isLong && (
        <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
          {expanded ? 'Show Less' : 'Read More'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 20 },
  dateGroup: { marginBottom: 24 },
  dateHeader: { marginBottom: 16, paddingLeft: 12 },
  dateText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  itemRow: { flexDirection: 'row', paddingLeft: 8 },
  leftCol: { alignItems: 'center', width: 40 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  line: { width: 2, flex: 1, marginVertical: 4 },
  contentCol: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '800' },
  itemTime: { fontSize: 11, fontWeight: '600' },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 },
  actorName: { fontSize: 13, fontWeight: '700' },
  roleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontSize: 9, fontWeight: '800' },
  remarks: { fontSize: 14, lineHeight: 20 },
  attachmentRow: { gap: 8, marginTop: 12 },
  attachmentThumb: { width: 80, height: 80, borderRadius: 8 }
});
