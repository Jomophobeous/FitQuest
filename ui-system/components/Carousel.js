/**
 * UI System — Carousel Component Spec
 * Phase 31: Component Lock System
 * 
 * RULE: All horizontal swipeable content MUST use this pattern.
 *       Used for onboarding flows, feature tours, exercise previews.
 */

module.exports = {
  name: 'Carousel',
  locked: true,
  implementation: 'ui-system/components/Carousel.js',

  props: {
    items: { type: 'Array<{ id: string, content: ReactNode }>', required: true },
    autoPlay: { type: 'boolean', default: false, description: 'Auto-advance slides' },
    autoPlayInterval: { type: 'number', default: 4000, description: 'ms between auto-advance' },
    showDots: { type: 'boolean', default: true, description: 'Show pagination dots' },
    showArrows: { type: 'boolean', default: false, description: 'Show prev/next arrows' },
    onSlideChange: { type: '(index: number) => void', required: false },
    loop: { type: 'boolean', default: false },
    style: { type: 'ViewStyle', required: false },
  },

  tokens: {
    dot_active: 'theme.colors.accent (#10B981)',
    dot_inactive: 'theme.colors.border',
    dot_size: 8,
    dot_gap: 'theme.spacing[2] (8)',
    arrow_color: 'theme.colors.textSecondary',
    arrow_bg: 'theme.colors.surface',
    slide_gap: 'theme.spacing[4] (16)',
    container_padding: 'theme.spacing[4] (16)',
  },

  structure: {
    jsx: `
<View style={[styles.container, style]}>
  <FlatList
    ref={flatListRef}
    data={items}
    horizontal
    pagingEnabled
    showsHorizontalScrollIndicator={false}
    onMomentumScrollEnd={handleScrollEnd}
    renderItem={({ item }) => (
      <View style={[styles.slide, { width: screenWidth }]}>
        {item.content}
      </View>
    )}
    keyExtractor={(item) => item.id}
  />
  {showDots && (
    <View style={styles.dotContainer}>
      {items.map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  )}
</View>
    `,
    mechanism: 'FlatList with pagingEnabled — native scroll performance, no third-party carousel libs',
  },

  violations: [
    'Using ScrollView for carousel-like patterns',
    'Installing third-party carousel libraries (react-native-snap-carousel, etc.)',
    'Creating horizontal scroll without pagination dots',
    'Hardcoding dot colors',
    'Using setTimeout for auto-play instead of useEffect + cleanup',
  ],

  examples: {
    onboarding: `
<Carousel
  items={[
    { id: '1', content: <OnboardingSlide1 /> },
    { id: '2', content: <OnboardingSlide2 /> },
    { id: '3', content: <OnboardingSlide3 /> },
  ]}
  showDots
  autoPlay
/>`,
    exercises: `
<Carousel
  items={exercises.map(e => ({ id: e.id, content: <ExercisePreview exercise={e} /> }))}
  showDots
  showArrows
/>`,
  },
};
