// Who a card can be for. The popular choices are what people see first; the
// full library sits behind "See more" and search. Edit freely: ids are used
// only inside the app (never in share links), but keep them stable so saved
// favourites and messages keep matching.

export type RecipientGroupId = 'family' | 'romantic' | 'friends' | 'professional' | 'other'

export type Recipient = {
  id: string
  label: string
  group: RecipientGroupId
  /** Extra words that should find this recipient in search. */
  aliases?: string[]
}

export const recipientGroups: Array<{ id: RecipientGroupId; label: string }> = [
  { id: 'family', label: 'Family' },
  { id: 'romantic', label: 'Partner & love' },
  { id: 'friends', label: 'Friends' },
  { id: 'professional', label: 'Work & school' },
  { id: 'other', label: 'Someone else' },
]

export const recipients: Recipient[] = [
  // Family
  { id: 'mother', label: 'Mother', group: 'family', aliases: ['mom', 'mum', 'mama', 'mommy'] },
  { id: 'father', label: 'Father', group: 'family', aliases: ['dad', 'papa', 'daddy'] },
  { id: 'parents', label: 'Mom and Dad', group: 'family', aliases: ['parents', 'mum and dad'] },
  { id: 'son', label: 'Son', group: 'family', aliases: ['child', 'kid', 'boy'] },
  { id: 'daughter', label: 'Daughter', group: 'family', aliases: ['child', 'kid', 'girl'] },
  { id: 'brother', label: 'Brother', group: 'family', aliases: ['sibling', 'bro'] },
  { id: 'sister', label: 'Sister', group: 'family', aliases: ['sibling', 'sis'] },
  { id: 'grandmother', label: 'Grandmother', group: 'family', aliases: ['grandma', 'granny', 'nana', 'lola'] },
  { id: 'grandfather', label: 'Grandfather', group: 'family', aliases: ['grandpa', 'granddad', 'lolo'] },
  { id: 'grandparents', label: 'Grandparents', group: 'family' },
  { id: 'grandchild', label: 'Grandchild', group: 'family', aliases: ['grandson', 'granddaughter'] },
  { id: 'aunt', label: 'Aunt', group: 'family', aliases: ['auntie'] },
  { id: 'uncle', label: 'Uncle', group: 'family' },
  { id: 'cousin', label: 'Cousin', group: 'family' },
  { id: 'niece', label: 'Niece', group: 'family' },
  { id: 'nephew', label: 'Nephew', group: 'family' },
  { id: 'mother-in-law', label: 'Mother-in-law', group: 'family' },
  { id: 'father-in-law', label: 'Father-in-law', group: 'family' },
  { id: 'parents-in-law', label: 'Parents-in-law', group: 'family', aliases: ['in-laws'] },
  // Romantic
  { id: 'husband', label: 'Husband', group: 'romantic', aliases: ['spouse', 'hubby', 'partner'] },
  { id: 'wife', label: 'Wife', group: 'romantic', aliases: ['spouse', 'partner'] },
  { id: 'boyfriend', label: 'Boyfriend', group: 'romantic', aliases: ['partner'] },
  { id: 'girlfriend', label: 'Girlfriend', group: 'romantic', aliases: ['partner'] },
  { id: 'fiance', label: 'Fiancé', group: 'romantic', aliases: ['fiancé', 'fiancee', 'fiancée', 'engaged'] },
  { id: 'life-partner', label: 'Life partner', group: 'romantic', aliases: ['partner'] },
  { id: 'crush', label: 'Crush', group: 'romantic' },
  { id: 'someone-special', label: 'Someone special', group: 'romantic' },
  { id: 'ex-partner', label: 'Ex-partner', group: 'romantic', aliases: ['ex'] },
  // Friends
  { id: 'friend', label: 'Friend', group: 'friends', aliases: ['pal', 'buddy'] },
  { id: 'best-friend', label: 'Best friend', group: 'friends', aliases: ['bestie', 'bff'] },
  { id: 'close-friend', label: 'Close friend', group: 'friends' },
  { id: 'childhood-friend', label: 'Childhood friend', group: 'friends' },
  { id: 'school-friend', label: 'School friend', group: 'friends', aliases: ['classmate'] },
  { id: 'college-friend', label: 'College friend', group: 'friends', aliases: ['university friend'] },
  { id: 'work-friend', label: 'Work friend', group: 'friends' },
  { id: 'neighbor', label: 'Neighbor', group: 'friends', aliases: ['neighbour'] },
  { id: 'roommate', label: 'Roommate', group: 'friends', aliases: ['flatmate', 'housemate'] },
  { id: 'online-friend', label: 'Online friend', group: 'friends' },
  { id: 'long-distance-friend', label: 'Long-distance friend', group: 'friends' },
  // Professional
  { id: 'boss', label: 'Boss', group: 'professional', aliases: ['employer', 'supervisor'] },
  { id: 'manager', label: 'Manager', group: 'professional' },
  { id: 'team-leader', label: 'Team leader', group: 'professional', aliases: ['team lead'] },
  { id: 'coworker', label: 'Coworker', group: 'professional', aliases: ['co-worker', 'workmate', 'teammate'] },
  { id: 'colleague', label: 'Colleague', group: 'professional' },
  { id: 'employee', label: 'Employee', group: 'professional', aliases: ['staff', 'team member'] },
  { id: 'client', label: 'Client', group: 'professional' },
  { id: 'customer', label: 'Customer', group: 'professional' },
  { id: 'business-partner', label: 'Business partner', group: 'professional' },
  { id: 'mentor', label: 'Mentor', group: 'professional' },
  { id: 'teacher', label: 'Teacher', group: 'professional', aliases: ['tutor', 'coach'] },
  { id: 'professor', label: 'Professor', group: 'professional', aliases: ['lecturer'] },
  { id: 'student', label: 'Student', group: 'professional', aliases: ['pupil'] },
  // Other
  { id: 'myself', label: 'Myself', group: 'other', aliases: ['me', 'self'] },
  { id: 'someone-i-miss', label: 'Someone I miss', group: 'other' },
  { id: 'someone-i-admire', label: 'Someone I admire', group: 'other' },
  { id: 'someone-going-through-a-hard-time', label: 'Someone going through a difficult time', group: 'other', aliases: ['hard time', 'struggling'] },
  { id: 'someone-i-owe-an-apology', label: 'Someone I owe an apology', group: 'other', aliases: ['apology', 'sorry'] },
  { id: 'new-acquaintance', label: 'New acquaintance', group: 'other' },
  { id: 'someone-i-dont-know-well', label: 'Someone I don’t know well', group: 'other' },
]

/**
 * The large buttons shown first. Each popular choice covers one or more
 * library recipients ("Husband / Wife" covers both), so one tap finds the
 * right messages without a long list. "Other" shows every message for the
 * occasion.
 */
export type RecipientChoice = { id: string; label: string; recipientIds: string[] }

export const popularRecipientChoices: RecipientChoice[] = [
  { id: 'mom', label: 'Mom', recipientIds: ['mother'] },
  { id: 'dad', label: 'Dad', recipientIds: ['father'] },
  { id: 'husband-wife', label: 'Husband / Wife', recipientIds: ['husband', 'wife'] },
  { id: 'boyfriend-girlfriend', label: 'Boyfriend / Girlfriend', recipientIds: ['boyfriend', 'girlfriend'] },
  { id: 'son-daughter', label: 'Son / Daughter', recipientIds: ['son', 'daughter'] },
  { id: 'brother-sister', label: 'Brother / Sister', recipientIds: ['brother', 'sister'] },
  { id: 'grandma-grandpa', label: 'Grandma / Grandpa', recipientIds: ['grandmother', 'grandfather', 'grandparents'] },
  { id: 'friend', label: 'Friend', recipientIds: ['friend', 'close-friend'] },
  { id: 'best-friend', label: 'Best friend', recipientIds: ['best-friend'] },
  { id: 'boss', label: 'Boss', recipientIds: ['boss', 'manager', 'team-leader'] },
  { id: 'coworker', label: 'Coworker', recipientIds: ['coworker', 'colleague', 'work-friend'] },
  { id: 'teacher', label: 'Teacher', recipientIds: ['teacher', 'professor', 'mentor'] },
  { id: 'other', label: 'Other', recipientIds: [] },
]

export function getRecipient(id: string): Recipient | undefined {
  return recipients.find((recipient) => recipient.id === id)
}

/** Turns a single library recipient into a choice, for picks made through "See more" or search. */
export function choiceForRecipient(recipient: Recipient): RecipientChoice {
  return { id: recipient.id, label: recipient.label, recipientIds: [recipient.id] }
}
