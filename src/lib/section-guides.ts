export const sectionGuides = [
  {
    id: 'spotter',
    tab: 'Spotter',
    title: 'Find',
    purpose: 'See it. Find the pieces.',
    tip: 'Crop to one outfit for clearer results.',
    example: 'That blue blazer in your saved screenshot.',
    steps: [
      'Upload a screenshot or outfit photo.',
      'Pick the piece you want to shop.',
      'Open a match or alternative. No results? Edit your search.',
    ],
  },
  {
    id: 'for-you',
    tab: 'For You',
    title: 'Style ideas',
    purpose: 'Find your next style idea.',
    tip: 'Save looks you like and hide ones you don’t.',
    example: 'Find a new way to wear relaxed tailoring.',
    steps: [
      'Choose your clothing preferences and interests.',
      'Explore the feed and open stories you like.',
      'Save, like or hide stories to shape your recommendations.',
    ],
  },
  {
    id: 'closet',
    tab: 'Closet',
    title: 'My Closet',
    purpose: 'Make more of what you own.',
    tip: 'Photograph one item at a time in good light.',
    example: 'Start with your favorite shirt, jeans and shoes.',
    steps: [
      'Add a photo of a piece you own.',
      'Check its name, category and color, then save.',
      'Choose “Style my clothes” and tell us your plans.',
    ],
  },
  {
    id: 'my-fits',
    tab: 'Looks',
    title: 'Saved',
    purpose: 'Keep the looks you love.',
    tip: 'Save a fit you like so it’s ready for next time.',
    example: 'Keep your go-to dinner outfit ready to wear.',
    steps: [
      'Build an outfit from your closet.',
      'Save it from outfit suggestions or the canvas.',
      'Revisit it in Saved, edit a copy or mark “Wore today.”',
    ],
  },
] as const;
