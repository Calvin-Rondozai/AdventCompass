import React, { useLayoutEffect } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, TERMS_URL } from '@/constants/legal';

type Section = { title: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    title: 'Acceptance of Terms',
    paragraphs: [
      'By installing or using AdventCompass, you agree to these Terms of Use. If you do not agree, please do not use the app.',
    ],
  },
  {
    title: 'Use of the App',
    paragraphs: [
      'AdventCompass is provided for personal, non-commercial use as a Bible study, devotional, and hymnal companion. You may use it on your own devices for your own spiritual study and reference.',
    ],
  },
  {
    title: 'Content Included in the App',
    paragraphs: [
      'Bible translations, Ellen G. White writings, hymnals, commentary, and other reference material bundled with the app are included under their respective public-domain status or permitted-use terms. Ownership of that content remains with its original authors or publishers; AdventCompass does not claim authorship of it.',
    ],
  },
  {
    title: 'Your Own Content',
    paragraphs: [
      'Notes, journal entries, highlights, and any other content you create in the app remain yours. Since this content is stored only on your device (see the Privacy Policy), you are responsible for backing it up if you want to keep it beyond the life of your device or app installation.',
    ],
  },
  {
    title: 'Health & Wellness Feature',
    paragraphs: [
      'The water and exercise tracking feature is a simple personal log, not medical advice or a medical device. Consult a qualified professional for guidance on your health.',
    ],
  },
  {
    title: 'No Warranty',
    paragraphs: [
      'AdventCompass is provided "as is," without warranty of any kind. While care is taken to keep Bible text, hymnal content, and reference material accurate, we do not guarantee the app will be error-free, uninterrupted, or fit for any particular purpose.',
    ],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      'To the fullest extent permitted by law, the developer is not liable for any indirect, incidental, or consequential damages arising from your use of, or inability to use, the app.',
    ],
  },
  {
    title: 'Changes',
    paragraphs: [
      'The app and these terms may be updated from time to time. Continued use of the app after an update means you accept the revised terms.',
    ],
  },
  {
    title: 'Contact Us',
    paragraphs: [`Questions about these terms can be sent to ${CONTACT_EMAIL}.`],
  },
];

export default function TermsOfUseScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Terms of Use' });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Heading style={{ marginBottom: 4 }}>Terms of Use</Heading>
        <Label style={{ marginBottom: theme.spacing.sm }}>Last updated: {LEGAL_LAST_UPDATED}</Label>
        <Label
          onPress={() => Linking.openURL(TERMS_URL)}
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
