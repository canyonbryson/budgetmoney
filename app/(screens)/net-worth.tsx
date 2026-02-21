import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { formatMoney } from '@/lib/money';

type BucketRole = 'savings' | 'investment';

export default function NetWorthScreen() {
  const { owner, isReady, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [months, setMonths] = React.useState<3 | 6 | 12>(12);
  const [bucketName, setBucketName] = React.useState('');
  const [bucketRole, setBucketRole] = React.useState<BucketRole>('savings');
  const [bucketApr, setBucketApr] = React.useState('4.00');
  const [savingBucketId, setSavingBucketId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, { name: string; apr: string }>>({});

  const summary = useQuery(
    api.netWorth.getSummary,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const timeline = useQuery(
    api.netWorth.getTimeline,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId, limit: 30 } : 'skip'
  );
  const projection = useQuery(
    api.netWorth.getProjection,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId, months } : 'skip'
  );
  const buckets = useQuery(
    api.netWorth.listBuckets,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  const createBucket = useMutation(api.netWorth.createBucket);
  const updateBucket = useMutation(api.netWorth.updateBucket);
  const deleteBucket = useMutation(api.netWorth.deleteBucket);

  const onCreateBucket = async () => {
    if (!owner || !bucketName.trim()) return;
    const parsedApr = Number(bucketApr);
    if (!Number.isFinite(parsedApr)) return;
    await createBucket({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      name: bucketName.trim(),
      role: bucketRole,
      interestRateApr: parsedApr,
    });
    setBucketName('');
    setBucketApr('4.00');
  };

  const onSaveBucket = async (bucketId: string) => {
    if (!owner) return;
    const draft = drafts[bucketId];
    if (!draft) return;
    const apr = Number(draft.apr);
    if (!Number.isFinite(apr)) return;
    try {
      setSavingBucketId(bucketId);
      await updateBucket({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        bucketId: bucketId as Id<'netWorthBuckets'>,
        name: draft.name.trim(),
        interestRateApr: apr,
      });
    } finally {
      setSavingBucketId(null);
    }
  };

  const onDeleteBucket = async (bucketId: string) => {
    if (!owner) return;
    await deleteBucket({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      bucketId: bucketId as Id<'netWorthBuckets'>,
    });
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!isSignedIn || !owner) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ThemedText>Sign in to view net worth details.</ThemedText>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">Net worth</ThemedText>

      {!summary ? (
        <Card><ActivityIndicator size="small" color={colors.primary} /></Card>
      ) : (
        <Card variant="elevated">
          <View style={{ gap: spacing.sm }}>
            <ThemedText style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase' }]}>Current</ThemedText>
            <ThemedText style={[typography.title, { fontSize: 34, lineHeight: 40 }]}>{formatMoney(summary.netWorthTotal)}</ThemedText>
            <ThemedText>Assets: {formatMoney(summary.assetsTotal)}</ThemedText>
            <ThemedText>Liabilities: {formatMoney(summary.liabilitiesTotal)}</ThemedText>
            <ThemedText>Checking: {formatMoney(summary.checkingTotal)}</ThemedText>
            <ThemedText>Savings: {formatMoney(summary.savingsTotal)}</ThemedText>
            <ThemedText>Investments: {formatMoney(summary.investmentTotal)}</ThemedText>
          </View>
        </Card>
      )}

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">Net worth over time</ThemedText>
          {(timeline?.points ?? []).map((point) => (
            <View key={point.asOfDate} style={styles.row}>
              <ThemedText>{point.asOfDate}</ThemedText>
              <ThemedText>{formatMoney(point.netWorthTotal)}</ThemedText>
            </View>
          ))}
          {!timeline?.points?.length ? <ThemedText style={{ color: colors.textSecondary }}>No snapshot history yet.</ThemedText> : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">Projection</ThemedText>
          <View style={[styles.buttonRow, { gap: spacing.xs }]}>
            {[3, 6, 12].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={months === value ? 'primary' : 'outline'}
                onPress={() => setMonths(value as 3 | 6 | 12)}
              >
                {value}m
              </Button>
            ))}
          </View>
          {(projection?.points ?? []).map((point) => (
            <View key={`${point.asOfDate}-${point.monthIndex}`} style={styles.row}>
              <ThemedText>{point.asOfDate}</ThemedText>
              <ThemedText>{formatMoney(point.netWorthTotal)}</ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">Buckets</ThemedText>
          <View style={[styles.buttonRow, { gap: spacing.xs }]}>
            <Button size="sm" variant={bucketRole === 'savings' ? 'primary' : 'outline'} onPress={() => setBucketRole('savings')}>
              Savings
            </Button>
            <Button size="sm" variant={bucketRole === 'investment' ? 'primary' : 'outline'} onPress={() => setBucketRole('investment')}>
              Investment
            </Button>
          </View>
          <TextInput
            value={bucketName}
            onChangeText={setBucketName}
            placeholder="Bucket name"
            style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md }]}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            value={bucketApr}
            onChangeText={setBucketApr}
            placeholder="APR %"
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.md }]}
            placeholderTextColor={colors.textMuted}
          />
          <Button onPress={onCreateBucket}>Create bucket</Button>

          {(buckets ?? []).map((bucket) => {
            const draft = drafts[bucket._id] ?? { name: bucket.name, apr: String(bucket.interestRateApr) };
            return (
              <View key={bucket._id} style={[styles.bucketRow, { borderColor: colors.borderLight, borderRadius: borderRadius.md, padding: spacing.sm }]}>
                <TextInput
                  value={draft.name}
                  onChangeText={(value) =>
                    setDrafts((prev) => ({ ...prev, [bucket._id]: { ...draft, name: value } }))
                  }
                  style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.sm }]}
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  value={draft.apr}
                  onChangeText={(value) =>
                    setDrafts((prev) => ({ ...prev, [bucket._id]: { ...draft, apr: value } }))
                  }
                  keyboardType="decimal-pad"
                  style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: borderRadius.sm }]}
                  placeholderTextColor={colors.textMuted}
                />
                <View style={[styles.buttonRow, { gap: spacing.xs }]}>
                  <Button size="sm" variant="outline" onPress={() => onSaveBucket(bucket._id)} disabled={savingBucketId === bucket._id}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => onDeleteBucket(bucket._id)}>
                    Delete
                  </Button>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bucketRow: {
    borderWidth: 1,
    gap: 8,
  },
});
