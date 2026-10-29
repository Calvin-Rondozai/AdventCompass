import React, { useLayoutEffect } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRIVACY_URL } from '@/constants/legal';

type Section = { title: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    title: 'Overview',
    paragraphs: [
      'AdventCompass is designed to work as a personal Bible study companion without requiring an account or sending your activity to a server. This policy explains what information the app handles, why, and where it stays.',
    ],
  },
  {
    title: 'Information Stored On Your Device',
    paragraphs: [
      'Bookmarks, highlights, notes, prayer journal entries, reading-plan progress, hymn favorites, water and exercise logs, and app preferences (such as theme and translation choice) are all saved in a local database on your device.',
      'None of this content is uploaded to us or to any third party. Uninstalling the app, or clearing its data, permanently deletes it — we have no copy and cannot recover it for you.',
    ],
  },
  {
    title: 'Location',
    paragraphs: [
      "If you enable it, AdventCompass uses your device's location to calculate the local sunset time for the Friday/Saturday Sabbath greeting. This is a one-time, low-accuracy location read, cached on your device, and is never transmitted anywhere. You can decline location access and the app falls back to a fixed time.",
    ],
  },
  {
    title: 'On-Device AI Assistant',
    paragraphs: [
      'The AI Bible Assistant runs a language model directly on your device. Questions you ask it, and the answers it gives, are processed locally and are not sent to us or to any AI provider over the network.',
      "The first time you use this feature, the app downloads the model file itself from Hugging Face's public model hosting so it can run offline afterward. That one-time download exposes your device's network address to Hugging Face the way any file download would, but no content of your questions is involved.",
    ],
  },
  {
    title: 'Downloaded Study Content',
    paragraphs: [
      'Some content — Sabbath School lesson quarters, PDF lesson sets — is fetched on demand from the public sources that publish it, only when you choose to download it. These requests do not include any personal or usage data beyond what is needed to fetch the file.',
    ],
  },
  {
    title: 'Notifications',
    paragraphs: [
      'Reminder notifications (water, prayer, Bible reading, Sabbath, etc.) are scheduled and delivered entirely on your device using the operating system’s local notification system. They are not push notifications from a remote server, and no data about your reminders leaves your device.',
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      'AdventCompass does not knowingly collect personal information from anyone, including children, because it does not collect personal information from its users at all — everything described above stays on the device.',
    ],
  },
  {
    title: 'Changes to This Policy',
    paragraphs: [
      'If this policy changes, the updated version will be published on the public Privacy Policy page and in the app with a new "last updated" date.',
    ],
  },
  {
    title: 'Contact Us',
    paragraphs: [`Questions about this policy can be sent to ${CONTACT_EMAIL}.`],
  },
];

export default function PrivacyPolicyScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Privacy Policy' });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Heading style={{ marginBottom: 4 }}>Privacy Policy</Heading>
        <Label style={{ marginBottom: theme.spacing.sm }}>Last updated: {LEGAL_LAST_UPDATED}</Label>
        <Label
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={{ marginBottom: theme.spacing.lg, color: theme.colors.primary }}
        >
          View on the web
        </Label>

        {SECTIONS.map((section, i) => (
          <View key={section.title} style={{ marginBottom: i === SECTIONS.length - 1 ? 0 : theme.spacing.lg }}>
            <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.md, marginBottom: theme.spacing.xs }}>
              {section.title}
            </Body>
            {section.paragraphs.map((p, j) => (
              <Body
                key={j}
                style={{ color: theme.colors.textMuted, marginTop: j === 0 ? 0 : theme.spacing.xs, lineHeight: theme.lineHeight.base }}
              >
                {p}
              </Body>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
