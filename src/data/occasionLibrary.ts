import type { Occasion as DesignOccasion } from './templates'

// What a card is for. The popular occasions are shown first; the rest sit
// behind "See more" and search. Ids are used only inside the app (never in
// share links); keep them stable so messages and favourites keep matching.

export type OccasionGroupId = 'celebrations' | 'appreciation' | 'support' | 'relationships' | 'apologies' | 'holidays' | 'everyday'

export type OccasionEntry = {
  id: string
  label: string
  group: OccasionGroupId
  /** Shown as a large button before "See more". */
  popular?: boolean
  /**
   * For less common occasions: the popular occasion whose messages and
   * designs to borrow when this one has few or none of its own.
   */
  relatedTo?: string
  /**
   * Which existing set of Little Hello designs fits this occasion until it has
   * artwork of its own. Only these 5 design sets exist today.
   */
  designs: DesignOccasion
  /** Extra words that should find this occasion in search. */
  aliases?: string[]
}

export const occasionGroups: Array<{ id: OccasionGroupId; label: string }> = [
  { id: 'celebrations', label: 'Celebrations' },
  { id: 'appreciation', label: 'Thanks & praise' },
  { id: 'support', label: 'Support & comfort' },
  { id: 'relationships', label: 'Love & friendship' },
  { id: 'apologies', label: 'Apologies' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'everyday', label: 'Everyday' },
]

export const occasionLibrary: OccasionEntry[] = [
  // Popular, in the order people see them
  { id: 'birthday', label: 'Birthday', group: 'celebrations', popular: true, designs: 'Birthday', aliases: ['bday', 'happy birthday'] },
  { id: 'anniversary', label: 'Anniversary', group: 'celebrations', popular: true, designs: 'Love', aliases: ['wedding anniversary'] },
  { id: 'thank-you', label: 'Thank you', group: 'appreciation', popular: true, designs: 'Thank you', aliases: ['thanks', 'gratitude'] },
  { id: 'congratulations', label: 'Congratulations', group: 'appreciation', popular: true, designs: 'Congratulations', aliases: ['congrats', 'well done'] },
  { id: 'i-love-you', label: 'I love you', group: 'relationships', popular: true, designs: 'Love', aliases: ['love'] },
  { id: 'i-miss-you', label: 'I miss you', group: 'relationships', popular: true, designs: 'Just because', aliases: ['missing you'] },
  { id: 'get-well-soon', label: 'Get well soon', group: 'support', popular: true, designs: 'Just because', aliases: ['feel better', 'recovery', 'sick', 'illness'] },
  { id: 'good-luck', label: 'Good luck', group: 'support', popular: true, designs: 'Congratulations', aliases: ['best of luck', 'exam', 'interview'] },
  { id: 'im-sorry', label: 'I’m sorry', group: 'apologies', popular: true, designs: 'Just because', aliases: ['sorry', 'apology', 'apologize', 'apologise'] },
  { id: 'thinking-of-you', label: 'Thinking of you', group: 'support', popular: true, designs: 'Just because' },
  { id: 'mothers-day', label: 'Mother’s Day', group: 'holidays', popular: true, designs: 'Thank you', aliases: ['mothers day', 'mom', 'mum'] },
  { id: 'fathers-day', label: 'Father’s Day', group: 'holidays', popular: true, designs: 'Thank you', aliases: ['fathers day', 'dad'] },
  { id: 'christmas', label: 'Christmas', group: 'holidays', popular: true, designs: 'Just because', aliases: ['xmas', 'holidays', 'merry christmas'] },
  { id: 'new-year', label: 'New Year', group: 'holidays', popular: true, designs: 'Congratulations', aliases: ['happy new year'] },
  { id: 'just-because', label: 'Just because', group: 'appreciation', popular: true, designs: 'Just because', aliases: ['no reason', 'hello'] },

  // Celebrations
  { id: 'milestone-birthday', label: 'Milestone birthday', group: 'celebrations', relatedTo: 'birthday', designs: 'Birthday', aliases: ['30th', '40th', '50th', '60th', '70th', '80th', '90th', '100th'] },
  { id: 'wedding', label: 'Wedding', group: 'celebrations', relatedTo: 'congratulations', designs: 'Love', aliases: ['marriage', 'newlyweds'] },
  { id: 'relationship-anniversary', label: 'Relationship anniversary', group: 'celebrations', relatedTo: 'anniversary', designs: 'Love' },
  { id: 'graduation', label: 'Graduation', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['graduate'] },
  { id: 'promotion', label: 'Promotion', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations' },
  { id: 'new-job', label: 'New job', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations' },
  { id: 'new-business', label: 'New business', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations' },
  { id: 'new-home', label: 'New home', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['housewarming', 'moving'] },
  { id: 'new-baby', label: 'New baby', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['birth', 'newborn'] },
  { id: 'retirement', label: 'Retirement', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['retiring'] },
  { id: 'achievement', label: 'Achievement', group: 'celebrations', relatedTo: 'congratulations', designs: 'Congratulations' },
  // Appreciation
  { id: 'appreciation', label: 'Appreciation', group: 'appreciation', relatedTo: 'thank-you', designs: 'Thank you' },
  { id: 'recognition', label: 'Recognition', group: 'appreciation', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['well done', 'great job'] },
  // Support
  { id: 'sending-strength', label: 'Sending strength', group: 'support', relatedTo: 'thinking-of-you', designs: 'Just because' },
  { id: 'sympathy', label: 'Sympathy', group: 'support', relatedTo: 'thinking-of-you', designs: 'Just because', aliases: ['loss', 'grief', 'passing'] },
  { id: 'condolences', label: 'Condolences', group: 'support', relatedTo: 'sympathy', designs: 'Just because', aliases: ['loss', 'grief', 'passing', 'funeral'] },
  { id: 'comfort', label: 'Comfort', group: 'support', relatedTo: 'thinking-of-you', designs: 'Just because' },
  { id: 'encouragement', label: 'Encouragement', group: 'support', relatedTo: 'good-luck', designs: 'Just because', aliases: ['you can do it', 'keep going'] },
  // Relationships
  { id: 'proud-of-you', label: 'I’m proud of you', group: 'relationships', relatedTo: 'congratulations', designs: 'Congratulations', aliases: ['proud'] },
  { id: 'here-for-you', label: 'I’m here for you', group: 'relationships', relatedTo: 'thinking-of-you', designs: 'Just because' },
  // Apologies
  { id: 'forgiveness', label: 'Asking for forgiveness', group: 'apologies', relatedTo: 'im-sorry', designs: 'Just because', aliases: ['forgive me'] },
  { id: 'making-amends', label: 'Making amends', group: 'apologies', relatedTo: 'im-sorry', designs: 'Just because' },
  { id: 'reconciliation', label: 'Reconciliation', group: 'apologies', relatedTo: 'im-sorry', designs: 'Just because', aliases: ['make up'] },
  // Holidays
  { id: 'valentines-day', label: 'Valentine’s Day', group: 'holidays', relatedTo: 'i-love-you', designs: 'Love', aliases: ['valentine', 'valentines'] },
  { id: 'easter', label: 'Easter', group: 'holidays', relatedTo: 'just-because', designs: 'Just because' },
  { id: 'halloween', label: 'Halloween', group: 'holidays', relatedTo: 'just-because', designs: 'Just because' },
  { id: 'thanksgiving', label: 'Thanksgiving', group: 'holidays', relatedTo: 'thank-you', designs: 'Thank you' },
  // Everyday
  { id: 'good-morning', label: 'Good morning', group: 'everyday', relatedTo: 'just-because', designs: 'Just because' },
  { id: 'good-night', label: 'Good night', group: 'everyday', relatedTo: 'just-because', designs: 'Just because' },
  { id: 'have-a-great-day', label: 'Have a great day', group: 'everyday', relatedTo: 'just-because', designs: 'Just because' },
  { id: 'safe-travels', label: 'Safe travels', group: 'everyday', relatedTo: 'good-luck', designs: 'Just because', aliases: ['trip', 'journey', 'bon voyage'] },
  { id: 'farewell', label: 'Farewell', group: 'everyday', relatedTo: 'good-luck', designs: 'Just because', aliases: ['goodbye', 'leaving', 'moving away'] },
  { id: 'welcome', label: 'Welcome', group: 'everyday', relatedTo: 'just-because', designs: 'Just because', aliases: ['welcome back'] },
]

export const popularOccasions = occasionLibrary.filter((occasion) => occasion.popular)

export function getOccasion(id: string): OccasionEntry | undefined {
  return occasionLibrary.find((occasion) => occasion.id === id)
}
