import React, { useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ChevronRight } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { getQuarterData, SabbathQuarterData } from '@/database/sabbathSchool';
import { PageLoader } from '@/components/ui/PageLoader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Body, Label } from '@/components/ui/Typography';

export default function SabbathQuarterLessonsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quarter, setQuarter] = useState<SabbathQuarterData | null>(null);

  useEffect(() => {
    if (id) getQuarterData(db, id).then(setQuarter);
  }, [db, id]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: quarter?.title ?? 'Sabbath School' });
  }, [navigation, quarter]);

  if (!quarter) return <PageLoader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <FlatList
        data={quarter.lessons}
        keyExtractor={(item) => String(item.week)}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        renderItem={({ item, index }) => (
          <PressableScale
            onPress={() => router.push({ pathname: '/more/sabbath-school/[id]/[week]', params: { id: id ?? '', week: String(item.week) } })}
            scaleTo={0.99}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.sm + 2,
                borderBottomWidth: index === quarter.lessons.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Label style={{ width: 32 }}>{item.week}</Label>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: theme.fontFamily.sansSemiBold }}>{item.title}</Body>
                <Label style={{ marginTop: 2 }}>Begins {item.startDate}</Label>
              </View>
              <ChevronRight size={16} color={theme.colors.textFaint} />
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}
