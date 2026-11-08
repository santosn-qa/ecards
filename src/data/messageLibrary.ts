import type { RecipientGroupId } from './recipientLibrary'

// Little Hello's ready-made messages. All are original, written for the app.
//
// To add a message: append an entry with a new, unique id. `recipients` may
// list recipient ids (see recipientLibrary.ts), group ids ('family',
// 'romantic', 'friends', 'professional', 'other') or 'anyone'. `occasion` is an
// id from occasionLibrary.ts. Keep text under 500 characters (the editor's
// limit) with no placeholders like [Name]: the card adds To and From itself.
// Length and language are derived, so they can never disagree with the text.

export type MessageTone =
  | 'heartfelt' | 'sweet' | 'emotional' | 'funny' | 'playful' | 'romantic' | 'inspirational'
  | 'encouraging' | 'simple' | 'casual' | 'formal' | 'professional' | 'sentimental'

export type MessageLength = 'short' | 'medium' | 'long'

export type RecipientKey = string | RecipientGroupId | 'anyone'

type MessageSource = {
  id: string
  occasion: string
  recipients: RecipientKey[]
  tone: MessageTone
  text: string
  tags: string[]
}

export type LibraryMessage = MessageSource & { length: MessageLength; language: 'en' }

const PARTNERS: RecipientKey[] = ['husband', 'wife', 'boyfriend', 'girlfriend', 'fiance', 'life-partner', 'someone-special', 'romantic']
const FRIENDS: RecipientKey[] = ['friend', 'best-friend', 'close-friend', 'friends']
const WORK: RecipientKey[] = ['professional']
const BOSSES: RecipientKey[] = ['boss', 'manager', 'team-leader', 'mentor']
const COWORKERS: RecipientKey[] = ['coworker', 'colleague', 'work-friend']
const GRANDPARENTS: RecipientKey[] = ['grandmother', 'grandfather', 'grandparents']
const SIBLINGS: RecipientKey[] = ['brother', 'sister']
const CHILDREN: RecipientKey[] = ['son', 'daughter', 'grandchild', 'niece', 'nephew']

const sources: MessageSource[] = [
  // Birthday – Mother
  { id: 'birthday-mother-001', occasion: 'birthday', recipients: ['mother'], tone: 'heartfelt', tags: ['mom', 'gratitude'], text: 'Happy birthday, Mom. Thank you for every hug, every phone call and every time you believed in me.' },
  { id: 'birthday-mother-002', occasion: 'birthday', recipients: ['mother'], tone: 'sweet', tags: ['mom', 'kindness', 'tea'], text: 'Happy birthday to the woman who taught me how to be kind, how to laugh at myself and how to make a really good cup of tea. I love you, Mom.' },
  { id: 'birthday-mother-003', occasion: 'birthday', recipients: ['mother'], tone: 'sentimental', tags: ['mom', 'memories', 'gratitude'], text: "Mom, on your birthday I keep thinking about all the little things you did that I didn't notice at the time: the packed lunches, the late-night talks, the way you always saved me the last slice. I notice them now, and I'm so grateful. Happy birthday. I hope today gives back even a small part of the love you've given me." },
  { id: 'birthday-mother-004', occasion: 'birthday', recipients: ['mother'], tone: 'funny', tags: ['mom', 'humor'], text: "Happy birthday, Mom! I've finally realized you were right about almost everything. Please don't make me say that again." },
  { id: 'birthday-mother-005', occasion: 'birthday', recipients: ['mother'], tone: 'simple', tags: ['mom', 'kindness'], text: 'Happy birthday, Mom. You make the world a softer, kinder place.' },
  { id: 'birthday-mother-006', occasion: 'birthday', recipients: ['mother'], tone: 'heartfelt', tags: ['mom', 'family'], text: 'Another year of being the heart of our family. Happy birthday, Mom. I hope your day is as warm and generous as you are.' },
  { id: 'birthday-mother-007', occasion: 'birthday', recipients: ['mother'], tone: 'playful', tags: ['mom', 'cake'], text: 'Happy birthday to my favorite person to call when anything goes wrong, or right. Cake is on me this year, Mom.' },
  { id: 'birthday-mother-008', occasion: 'birthday', recipients: ['mother'], tone: 'emotional', tags: ['mom', 'comfort', 'love'], text: 'Happy birthday, Mom. Even now, when life feels uncertain, I still hear your voice telling me it will all work out. You have been my safe place for as long as I can remember. I hope you know how much you are loved, today and every day.' },
  { id: 'birthday-mother-009', occasion: 'birthday', recipients: ['mother'], tone: 'inspirational', tags: ['mom', 'strength'], text: "Mom, you've shown me what strength and grace look like, often at the same time. Wishing you a birthday full of rest, laughter and the people who love you most." },
  { id: 'birthday-mother-010', occasion: 'birthday', recipients: ['mother'], tone: 'casual', tags: ['mom', 'relax'], text: "Happy birthday, Mom! Put your feet up today. You've earned it a hundred times over." },

  // Birthday – Father
  { id: 'birthday-father-001', occasion: 'birthday', recipients: ['father'], tone: 'heartfelt', tags: ['dad', 'gratitude'], text: 'Happy birthday, Dad. Thank you for the advice, the dad jokes and for always being there when it mattered.' },
  { id: 'birthday-father-002', occasion: 'birthday', recipients: ['father'], tone: 'funny', tags: ['dad', 'jokes', 'humor'], text: "Happy birthday, Dad! I'd tell you a joke, but you've already told me all of them. Twice." },
  { id: 'birthday-father-003', occasion: 'birthday', recipients: ['father'], tone: 'sentimental', tags: ['dad', 'memories', 'strength'], text: "Dad, you taught me how to ride a bike, how to fix things that break and how to keep going when it's hard. I'm still learning from you. Happy birthday. I hope today is full of the quiet happiness you always make room for in everyone else's life." },
  { id: 'birthday-father-004', occasion: 'birthday', recipients: ['father'], tone: 'simple', tags: ['dad'], text: "Happy birthday, Dad. You're one of a kind, and I'm lucky you're mine." },
  { id: 'birthday-father-005', occasion: 'birthday', recipients: ['father'], tone: 'heartfelt', tags: ['dad', 'patience'], text: 'Wishing the happiest birthday to a man who leads with patience and loves without making a fuss about it. Thank you for everything, Dad.' },
  { id: 'birthday-father-006', occasion: 'birthday', recipients: ['father'], tone: 'playful', tags: ['dad', 'humor'], text: "Happy birthday, Dad! Another year wiser, another year of insisting you don't need directions." },
  { id: 'birthday-father-007', occasion: 'birthday', recipients: ['father'], tone: 'inspirational', tags: ['dad', 'kindness'], text: 'Dad, your steady kindness has shaped who I am. I hope this birthday brings you good company, good food and a little time to simply enjoy it all.' },
  { id: 'birthday-father-008', occasion: 'birthday', recipients: ['father'], tone: 'emotional', tags: ['dad', 'proud', 'love'], text: "Happy birthday, Dad. I don't say it often enough, but I'm proud to be your child. Every good decision I make has a little of you in it. Thank you for your quiet strength, your bad puns and your big heart. Have a wonderful day." },
  { id: 'birthday-father-009', occasion: 'birthday', recipients: ['father'], tone: 'casual', tags: ['dad', 'relax'], text: 'Happy birthday, Dad! Hope your day includes your favorite meal, your favorite chair and absolutely no chores.' },
  { id: 'birthday-father-010', occasion: 'birthday', recipients: ['father'], tone: 'simple', tags: ['dad', 'love'], text: 'Happy birthday to the best dad I could ask for. I love you.' },

  // Birthday – Friends
  { id: 'birthday-friend-001', occasion: 'birthday', recipients: FRIENDS, tone: 'heartfelt', tags: ['friendship', 'cake'], text: "Happy birthday! I'm so glad life gave me a friend like you. Here's to more laughs, more adventures and more cake." },
  { id: 'birthday-friend-002', occasion: 'birthday', recipients: FRIENDS, tone: 'funny', tags: ['friendship', 'humor', 'age'], text: "Happy birthday! Don't worry about getting older. Let's just celebrate before we both need a nap." },
  { id: 'birthday-friend-003', occasion: 'birthday', recipients: FRIENDS, tone: 'heartfelt', tags: ['friendship', 'support'], text: 'Happy birthday to a friend who always knows when to call, when to listen and when to bring snacks. You make ordinary days better just by being in them. I hope this year brings you as much joy as you bring everyone around you.' },
  { id: 'birthday-friend-004', occasion: 'birthday', recipients: FRIENDS, tone: 'sweet', tags: ['friendship'], text: 'Happy birthday, my friend. The world is brighter with you in it.' },
  { id: 'birthday-friend-005', occasion: 'birthday', recipients: FRIENDS, tone: 'playful', tags: ['dessert', 'humor'], text: "It's your birthday, which means you're allowed to eat dessert first. I checked. Enjoy every bite!" },
  { id: 'birthday-friend-006', occasion: 'birthday', recipients: [...FRIENDS, 'anyone'], tone: 'casual', tags: ['party', 'food'], text: 'Happy birthday! Hope your day is full of good food, great company and at least one surprise that makes you smile.' },
  { id: 'birthday-friend-007', occasion: 'birthday', recipients: ['best-friend'], tone: 'sentimental', tags: ['best friend', 'friendship'], text: "Happy birthday to my best friend. Through every chapter, the silly ones, the hard ones and the wonderful ones, you've been there. I can't imagine my life without you." },
  { id: 'birthday-friend-008', occasion: 'birthday', recipients: [...FRIENDS, 'anyone'], tone: 'inspirational', tags: ['new year of life', 'joy'], text: 'Wishing you a birthday that feels like a fresh start, and a year full of the things that make your heart happy.' },
  { id: 'birthday-friend-009', occasion: 'birthday', recipients: [...FRIENDS, 'anyone'], tone: 'simple', tags: ['thinking of you'], text: 'Happy birthday! Thinking of you and wishing you a really lovely day.' },
  { id: 'birthday-friend-010', occasion: 'birthday', recipients: ['best-friend'], tone: 'funny', tags: ['best friend', 'secrets', 'humor'], text: "Happy birthday to the only person who knows all my secrets and still likes me. Let's keep it that way. I know a few of yours too." },

  // Birthday – Partner
  { id: 'birthday-partner-001', occasion: 'birthday', recipients: PARTNERS, tone: 'romantic', tags: ['love'], text: 'Happy birthday, my love. Every year with you is my favorite year so far.' },
  { id: 'birthday-partner-002', occasion: 'birthday', recipients: PARTNERS, tone: 'romantic', tags: ['love', 'coffee', 'everyday'], text: "Happy birthday to the person who makes my coffee just right, laughs at my worst jokes and holds my hand through everything. I fall in love with you a little more every day. I can't wait to celebrate you today and always." },
  { id: 'birthday-partner-003', occasion: 'birthday', recipients: PARTNERS, tone: 'sweet', tags: ['love', 'together'], text: 'Happy birthday to my favorite person. Life is sweeter, funnier and so much better with you beside me.' },
  { id: 'birthday-partner-004', occasion: 'birthday', recipients: PARTNERS, tone: 'playful', tags: ['humor', 'age'], text: "Happy birthday, gorgeous! You don't look a day older, and if you do, I'm keeping that to myself." },
  { id: 'birthday-partner-005', occasion: 'birthday', recipients: ['husband'], tone: 'heartfelt', tags: ['husband', 'home', 'love'], text: 'Happy birthday to my wonderful husband. Thank you for your patience, your kindness and the way you make our house feel like home. I love you more than ever.' },
  { id: 'birthday-partner-006', occasion: 'birthday', recipients: ['wife'], tone: 'heartfelt', tags: ['wife', 'best friend', 'love'], text: "Happy birthday to my beautiful wife. You are my best friend, my partner and my favorite place to be. Here's to you, today and always." },
  { id: 'birthday-partner-007', occasion: 'birthday', recipients: PARTNERS, tone: 'simple', tags: ['love', 'lucky'], text: "Happy birthday, sweetheart. I'm so lucky to share my life with you." },
  { id: 'birthday-partner-008', occasion: 'birthday', recipients: PARTNERS, tone: 'sentimental', tags: ['love', 'memories'], text: 'Happy birthday, love. I still remember the moment I knew you were the one, and I still feel it every time you walk into the room. Thank you for building this life with me. I hope today feels as special as you make every day feel for me.' },
  { id: 'birthday-partner-009', occasion: 'birthday', recipients: PARTNERS, tone: 'funny', tags: ['humor', 'tv'], text: "Happy birthday to the love of my life and the official owner of the TV remote. Today, I'll even let you pick the show." },
  { id: 'birthday-partner-010', occasion: 'birthday', recipients: ['boyfriend', 'girlfriend', 'someone-special'], tone: 'sweet', tags: ['love', 'together'], text: "Happy birthday! I'm so glad you're mine. Let's make this year our best one yet." },
  { id: 'birthday-partner-011', occasion: 'birthday', recipients: PARTNERS, tone: 'heartfelt', tags: ['love', 'years', 'together'], text: 'Happy birthday to my partner in everything. After all our years together, you still make my heart lift when you smile. Here is to many more birthdays side by side.' },

  // Birthday – Work
  { id: 'birthday-work-001', occasion: 'birthday', recipients: WORK, tone: 'professional', tags: ['work'], text: 'Happy birthday! Wishing you a relaxing day and a wonderful year ahead.' },
  { id: 'birthday-work-002', occasion: 'birthday', recipients: BOSSES, tone: 'formal', tags: ['boss', 'guidance'], text: 'Happy birthday. Thank you for your guidance and support. Wishing you good health and happiness in the year ahead.' },
  { id: 'birthday-work-003', occasion: 'birthday', recipients: COWORKERS, tone: 'casual', tags: ['coworker', 'cake'], text: "Happy birthday! Work is a lot more fun with you around. Hope there's cake involved today." },
  { id: 'birthday-work-004', occasion: 'birthday', recipients: COWORKERS, tone: 'funny', tags: ['coworker', 'meetings', 'coffee', 'humor'], text: 'Happy birthday! May your inbox be quiet, your meetings be short and your coffee be strong.' },
  { id: 'birthday-work-005', occasion: 'birthday', recipients: WORK, tone: 'formal', tags: ['work', 'success'], text: "Warm wishes on your birthday. It's a pleasure working with you, and I hope the coming year brings you every success." },

  // Birthday – Grandparents, siblings, children
  { id: 'birthday-grandparent-001', occasion: 'birthday', recipients: ['grandmother'], tone: 'sweet', tags: ['grandma', 'cookies'], text: 'Happy birthday, Grandma! Thank you for all the love, wisdom and cookies over the years.' },
  { id: 'birthday-grandparent-002', occasion: 'birthday', recipients: ['grandfather'], tone: 'heartfelt', tags: ['grandpa', 'stories'], text: 'Happy birthday, Grandpa! Your stories, your laugh and your big heart mean the world to me.' },
  { id: 'birthday-grandparent-003', occasion: 'birthday', recipients: GRANDPARENTS, tone: 'sweet', tags: ['grandparents', 'home'], text: 'Happy birthday! Every visit with you feels like coming home. I love you so much.' },
  { id: 'birthday-grandparent-004', occasion: 'birthday', recipients: [...GRANDPARENTS, 'family'], tone: 'sentimental', tags: ['family', 'memories'], text: "Happy birthday! You've filled our family with so much love and so many happy memories. I hope today you feel just how treasured you are." },
  { id: 'birthday-sibling-001', occasion: 'birthday', recipients: SIBLINGS, tone: 'sweet', tags: ['sibling', 'friendship'], text: 'Happy birthday! Thanks for being my first friend and my forever teammate.' },
  { id: 'birthday-sibling-002', occasion: 'birthday', recipients: SIBLINGS, tone: 'funny', tags: ['sibling', 'humor'], text: "Happy birthday! I'm still the favorite, but I'll let you have today." },
  { id: 'birthday-sibling-003', occasion: 'birthday', recipients: [...SIBLINGS, 'cousin'], tone: 'heartfelt', tags: ['sibling', 'laughter'], text: "Happy birthday to the one who knows me best. Here's to many more years of laughing at things nobody else understands." },
  { id: 'birthday-child-001', occasion: 'birthday', recipients: CHILDREN, tone: 'heartfelt', tags: ['proud', 'growing up'], text: "Happy birthday! Watching you grow has been one of the greatest joys of my life. I'm so proud of you." },
  { id: 'birthday-child-002', occasion: 'birthday', recipients: CHILDREN, tone: 'sweet', tags: ['love', 'smile'], text: 'Happy birthday, sweetheart! You make me smile every single day. I love you to the moon and back.' },
  { id: 'birthday-child-003', occasion: 'birthday', recipients: CHILDREN, tone: 'encouraging', tags: ['support', 'future'], text: "Happy birthday! Wherever life takes you, remember how loved you are. I'm always in your corner, cheering you on." },
  { id: 'milestone-birthday-001', occasion: 'milestone-birthday', recipients: ['anyone'], tone: 'inspirational', tags: ['milestone', 'adventure'], text: "Happy milestone birthday! Here's to all the years behind you and all the adventures still ahead." },
  { id: 'milestone-birthday-002', occasion: 'milestone-birthday', recipients: ['anyone'], tone: 'heartfelt', tags: ['milestone', 'celebration'], text: "What a wonderful milestone! Celebrating you and all the love and laughter you've shared along the way." },

  // Thank you
  { id: 'thank-you-anyone-001', occasion: 'thank-you', recipients: ['anyone'], tone: 'heartfelt', tags: ['kindness', 'gratitude'], text: "Thank you so much. Your kindness meant more than you know, and I'm truly grateful." },
  { id: 'thank-you-anyone-002', occasion: 'thank-you', recipients: ['anyone'], tone: 'simple', tags: ['gratitude'], text: 'Just a little note to say thank you. You made a real difference.' },
  { id: 'thank-you-anyone-003', occasion: 'thank-you', recipients: ['anyone'], tone: 'emotional', tags: ['support', 'help'], text: "Thank you for being there when I needed it most. You didn't have to help, but you did, and you did it with such warmth. I won't forget it." },
  { id: 'thank-you-work-001', occasion: 'thank-you', recipients: WORK, tone: 'professional', tags: ['work', 'support'], text: 'Thank you for your support and hard work. It is genuinely appreciated.' },
  { id: 'thank-you-anyone-004', occasion: 'thank-you', recipients: ['anyone'], tone: 'playful', tags: ['hero', 'humor'], text: "Thank you! You're officially my hero for the week. Possibly the month." },
  { id: 'thank-you-teacher-001', occasion: 'thank-you', recipients: ['teacher', 'professor', 'mentor'], tone: 'heartfelt', tags: ['teacher', 'encouragement'], text: 'Thank you for your patience, your encouragement and for believing in me. Your lessons will stay with me for a long time.' },
  { id: 'thank-you-parents-001', occasion: 'thank-you', recipients: ['mother', 'father', 'parents', 'family'], tone: 'heartfelt', tags: ['family', 'gratitude'], text: "Thank you for everything you've done for me, big and small. I'm grateful every single day to have you." },

  // Congratulations
  { id: 'congratulations-anyone-001', occasion: 'congratulations', recipients: ['anyone'], tone: 'heartfelt', tags: ['hard work', 'success'], text: "Congratulations! All your hard work has paid off, and I couldn't be happier for you." },
  { id: 'congratulations-anyone-002', occasion: 'congratulations', recipients: ['anyone'], tone: 'simple', tags: ['success'], text: 'Congratulations! You did it, and every bit of this moment is yours.' },
  { id: 'congratulations-anyone-003', occasion: 'congratulations', recipients: ['anyone'], tone: 'emotional', tags: ['proud', 'hard work'], text: "Congratulations! I've watched you work so hard for this, and seeing it happen for you is wonderful. Take a moment to enjoy it. You've truly earned it." },
  { id: 'congratulations-work-001', occasion: 'congratulations', recipients: WORK, tone: 'formal', tags: ['work', 'achievement'], text: 'Congratulations on this well-deserved achievement. Wishing you continued success.' },
  { id: 'congratulations-anyone-004', occasion: 'congratulations', recipients: [...FRIENDS, 'family'], tone: 'playful', tags: ['famous', 'humor'], text: "Look at you! Congratulations. I'm telling everyone I knew you before you were famous." },
  { id: 'graduation-anyone-001', occasion: 'graduation', recipients: ['anyone'], tone: 'inspirational', tags: ['graduation', 'future'], text: "Congratulations, graduate! The future is wide open, and I can't wait to see where you go next." },
  { id: 'graduation-anyone-002', occasion: 'graduation', recipients: ['anyone'], tone: 'heartfelt', tags: ['graduation', 'proud'], text: "Congratulations on your graduation! All those late nights were worth it. I'm so proud of you." },
  { id: 'retirement-anyone-001', occasion: 'retirement', recipients: ['anyone'], tone: 'casual', tags: ['retirement', 'relax'], text: "Happy retirement! Here's to slow mornings, long walks and finally having time for everything you love." },
  { id: 'retirement-work-001', occasion: 'retirement', recipients: WORK, tone: 'formal', tags: ['retirement', 'work', 'gratitude'], text: "Congratulations on your retirement. Thank you for everything you've given over the years. Enjoy every moment of this new chapter." },
  { id: 'new-baby-anyone-001', occasion: 'new-baby', recipients: ['anyone'], tone: 'sweet', tags: ['baby', 'family'], text: 'Congratulations on your new arrival! Wishing your growing family lots of love, cuddles and a little sleep.' },
  { id: 'new-home-anyone-001', occasion: 'new-home', recipients: ['anyone'], tone: 'heartfelt', tags: ['home', 'memories'], text: 'Congratulations on your new home! May it be filled with laughter, good meals and happy memories.' },
  { id: 'wedding-anyone-001', occasion: 'wedding', recipients: ['anyone'], tone: 'romantic', tags: ['wedding', 'love'], text: 'Congratulations on your wedding! Wishing you a lifetime of love, laughter and adventures together.' },

  // Anniversary
  { id: 'anniversary-partner-001', occasion: 'anniversary', recipients: PARTNERS, tone: 'romantic', tags: ['love', 'choice'], text: 'Happy anniversary, my love. Choosing you is still the best decision I have ever made.' },
  { id: 'anniversary-partner-002', occasion: 'anniversary', recipients: PARTNERS, tone: 'sentimental', tags: ['love', 'home', 'years'], text: "Happy anniversary. Through the busy days, the quiet evenings and everything in between, you've been my home. Thank you for every year so far. I can't wait for the ones ahead." },
  { id: 'anniversary-partner-003', occasion: 'anniversary', recipients: PARTNERS, tone: 'playful', tags: ['love', 'humor'], text: "Happy anniversary! Another year of laughter, love and putting up with each other. I'd do it all again." },
  { id: 'anniversary-couple-001', occasion: 'anniversary', recipients: ['parents', 'grandparents', 'parents-in-law', 'family', 'friends', 'anyone'], tone: 'heartfelt', tags: ['couple', 'inspiration'], text: 'Happy anniversary to a wonderful couple. Your love is an inspiration to everyone around you.' },
  { id: 'anniversary-partner-004', occasion: 'anniversary', recipients: PARTNERS, tone: 'simple', tags: ['love'], text: 'Happy anniversary. I love you more today than ever.' },

  // Mother's Day
  { id: 'mothers-day-mother-001', occasion: 'mothers-day', recipients: ['mother', 'mother-in-law'], tone: 'heartfelt', tags: ['mom', 'gratitude'], text: "Happy Mother's Day! Thank you for your endless love, patience and support. I'm so lucky to be yours." },
  { id: 'mothers-day-mother-002', occasion: 'mothers-day', recipients: ['mother', 'mother-in-law', 'grandmother'], tone: 'sweet', tags: ['mom', 'rest'], text: "Happy Mother's Day to the woman who always puts everyone else first. Today, it's your turn." },
  { id: 'mothers-day-mother-003', occasion: 'mothers-day', recipients: ['mother'], tone: 'sentimental', tags: ['mom', 'lessons', 'love'], text: "Happy Mother's Day, Mom. You taught me how to care for others, how to stand up for myself and how to find joy in small things. Everything good in me started with you. I love you." },
  { id: 'mothers-day-grandmother-001', occasion: 'mothers-day', recipients: ['grandmother'], tone: 'heartfelt', tags: ['grandma', 'family'], text: "Happy Mother's Day, Grandma. Thank you for the stories, the hugs and all the love you've poured into our family." },
  { id: 'mothers-day-mother-004', occasion: 'mothers-day', recipients: ['mother', 'mother-in-law', 'grandmother', 'anyone'], tone: 'simple', tags: ['love'], text: "Happy Mother's Day. Sending you all my love, today and always." },

  // Father's Day
  { id: 'fathers-day-father-001', occasion: 'fathers-day', recipients: ['father', 'father-in-law'], tone: 'funny', tags: ['dad', 'jokes'], text: "Happy Father's Day! Thank you for your strength, your patience and your terrible jokes. I wouldn't trade any of it." },
  { id: 'fathers-day-father-002', occasion: 'fathers-day', recipients: ['father'], tone: 'heartfelt', tags: ['dad', 'hero'], text: "Happy Father's Day, Dad. You've always been my hero, even when you didn't know it." },
  { id: 'fathers-day-father-003', occasion: 'fathers-day', recipients: ['father'], tone: 'sentimental', tags: ['dad', 'memories', 'love'], text: "Happy Father's Day. Thank you for showing up for the school plays, the long drives and the hard conversations. You taught me what it means to be dependable and kind. I love you, Dad." },
  { id: 'fathers-day-grandfather-001', occasion: 'fathers-day', recipients: ['grandfather'], tone: 'heartfelt', tags: ['grandpa', 'wisdom'], text: "Happy Father's Day, Grandpa. Thank you for your wisdom, your stories and your gentle way with all of us." },
  { id: 'fathers-day-father-004', occasion: 'fathers-day', recipients: ['father', 'father-in-law', 'grandfather', 'anyone'], tone: 'simple', tags: ['relax'], text: "Happy Father's Day. Wishing you a relaxing day doing exactly what you love." },

  // Get well soon
  { id: 'get-well-soon-anyone-001', occasion: 'get-well-soon', recipients: ['anyone'], tone: 'sweet', tags: ['tea', 'hugs'], text: 'Get well soon! Sending warm thoughts, gentle hugs and a big pot of tea your way.' },
  { id: 'get-well-soon-anyone-002', occasion: 'get-well-soon', recipients: ['anyone'], tone: 'heartfelt', tags: ['rest', 'thinking of you'], text: "I'm so sorry you're not feeling well. Take all the time you need to rest. I'm thinking of you." },
  { id: 'get-well-soon-anyone-003', occasion: 'get-well-soon', recipients: ['anyone'], tone: 'emotional', tags: ['recovery', 'love'], text: "Sending you lots of love while you recover. Be patient with yourself, rest as much as you can and let others take care of you for a while. I can't wait to see you back on your feet." },
  { id: 'get-well-soon-anyone-004', occasion: 'get-well-soon', recipients: [...FRIENDS, 'family', 'anyone'], tone: 'playful', tags: ['humor', 'miss you'], text: 'Get well soon! The world is a little less fun without you in it, so hurry back, but only when you are ready.' },
  { id: 'get-well-soon-work-001', occasion: 'get-well-soon', recipients: WORK, tone: 'professional', tags: ['work', 'recovery'], text: "Wishing you a smooth and speedy recovery. Take care of yourself. We're all thinking of you." },

  // Encouragement
  { id: 'encouragement-anyone-001', occasion: 'encouragement', recipients: ['anyone'], tone: 'encouraging', tags: ['belief', 'support'], text: 'You can do this. I believe in you, today and every day.' },
  { id: 'encouragement-anyone-002', occasion: 'encouragement', recipients: ['anyone'], tone: 'encouraging', tags: ['strength', 'hard times'], text: "Hard times don't last forever, and you're stronger than you know. I'm cheering for you." },
  { id: 'encouragement-anyone-003', occasion: 'encouragement', recipients: ['anyone'], tone: 'emotional', tags: ['support', 'one step at a time'], text: "I know things feel heavy right now. Take it one small step at a time, and remember you don't have to carry it all alone. I'm here, and I believe in you." },
  { id: 'encouragement-anyone-004', occasion: 'encouragement', recipients: ['anyone'], tone: 'inspirational', tags: ['courage', 'change', 'proud'], text: "Every big change starts with one brave step. I'm so proud of you for taking yours." },
  { id: 'encouragement-anyone-005', occasion: 'encouragement', recipients: ['anyone'], tone: 'simple', tags: ['support'], text: "Just a reminder: you've got this, and I've got you." },

  // I miss you
  { id: 'i-miss-you-anyone-001', occasion: 'i-miss-you', recipients: ['anyone'], tone: 'simple', tags: ['missing you'], text: "I miss you! Life just isn't the same without you nearby." },
  { id: 'i-miss-you-anyone-002', occasion: 'i-miss-you', recipients: ['anyone'], tone: 'sweet', tags: ['missing you', 'together'], text: "Thinking of you and missing you lots. I can't wait until we're together again." },
  { id: 'i-miss-you-anyone-003', occasion: 'i-miss-you', recipients: ['anyone'], tone: 'sentimental', tags: ['missing you', 'memories', 'long distance'], text: "Some days I hear a song or pass a café and think, I need to tell you about this. I miss our talks, our laughs and simply being near you. Until we see each other again, know you're always in my heart." },
  { id: 'i-miss-you-partner-001', occasion: 'i-miss-you', recipients: PARTNERS, tone: 'romantic', tags: ['missing you', 'love'], text: 'Missing you more than words can say. Counting the days until I can hold you again.' },
  { id: 'i-miss-you-anyone-004', occasion: 'i-miss-you', recipients: [...FRIENDS, 'family', 'anyone'], tone: 'playful', tags: ['missing you', 'humor'], text: 'I miss you! Please come back soon. Nobody else laughs at my jokes.' },

  // I love you
  { id: 'i-love-you-partner-001', occasion: 'i-love-you', recipients: PARTNERS, tone: 'romantic', tags: ['love', 'everyday'], text: 'I love you. Not just today, but in every ordinary moment we share.' },
  { id: 'i-love-you-partner-002', occasion: 'i-love-you', recipients: PARTNERS, tone: 'romantic', tags: ['love', 'laughter'], text: 'I love the way you laugh, the way you care and the way you make every day feel lighter. Thank you for being you, and for letting me love you.' },
  { id: 'i-love-you-anyone-001', occasion: 'i-love-you', recipients: ['anyone'], tone: 'sweet', tags: ['love', 'humor'], text: "Just a little note to say I love you. That's it. That's the whole card." },
  { id: 'i-love-you-family-001', occasion: 'i-love-you', recipients: ['family', 'friends'], tone: 'heartfelt', tags: ['love', 'family'], text: 'I love you more than I say. Thank you for always being there for me.' },
  { id: 'i-love-you-partner-003', occasion: 'i-love-you', recipients: PARTNERS, tone: 'romantic', tags: ['love'], text: 'You are my favorite hello and my hardest goodbye. I love you.' },

  // Apologies
  { id: 'im-sorry-anyone-001', occasion: 'im-sorry', recipients: ['anyone'], tone: 'simple', tags: ['apology', 'forgiveness'], text: "I'm sorry. I was wrong, and I hope you can forgive me." },
  { id: 'im-sorry-anyone-002', occasion: 'im-sorry', recipients: ['anyone'], tone: 'heartfelt', tags: ['apology', 'make it right'], text: "I'm truly sorry for hurting you. You matter to me, and I want to make things right." },
  { id: 'im-sorry-anyone-003', occasion: 'im-sorry', recipients: ['anyone'], tone: 'emotional', tags: ['apology', 'listen'], text: "I've been thinking a lot about what happened, and I'm so sorry. I should have listened more and spoken more kindly. I value you so much, and I hope we can talk soon." },
  { id: 'im-sorry-anyone-004', occasion: 'im-sorry', recipients: [...PARTNERS, ...FRIENDS, 'family'], tone: 'sweet', tags: ['apology', 'miss you'], text: "I'm sorry. I miss us, and I'd love the chance to make it up to you." },
  { id: 'im-sorry-work-001', occasion: 'im-sorry', recipients: WORK, tone: 'professional', tags: ['apology', 'work', 'responsibility'], text: "Please accept my sincere apology. I take full responsibility, and I'll do better going forward." },

  // Thinking of you
  { id: 'thinking-of-you-anyone-001', occasion: 'thinking-of-you', recipients: ['anyone'], tone: 'sweet', tags: ['hug'], text: "Just wanted you to know I'm thinking of you today. Sending a big hug." },
  { id: 'thinking-of-you-anyone-002', occasion: 'thinking-of-you', recipients: ['anyone'], tone: 'casual', tags: ['hello'], text: "No special reason. You've simply been on my mind, and I wanted to say hello." },
  { id: 'thinking-of-you-anyone-003', occasion: 'thinking-of-you', recipients: ['anyone'], tone: 'heartfelt', tags: ['support', 'love'], text: "I've been thinking of you and hoping you're doing okay. Whatever today looks like for you, please know someone is cheering for you and sending love your way." },
  { id: 'thinking-of-you-support-001', occasion: 'thinking-of-you', recipients: ['someone-going-through-a-hard-time', 'anyone'], tone: 'emotional', tags: ['support', 'difficult time'], text: "I'm thinking of you during this difficult time. I'm here whenever you need me, for a talk, a walk or just some quiet company." },
  { id: 'thinking-of-you-anyone-004', occasion: 'thinking-of-you', recipients: ['anyone'], tone: 'simple', tags: ['warm wishes'], text: 'Thinking of you and sending warm wishes.' },

  // Sympathy
  { id: 'sympathy-anyone-001', occasion: 'sympathy', recipients: ['anyone'], tone: 'simple', tags: ['loss', 'condolences'], text: "I'm so sorry for your loss. Holding you close in my thoughts." },
  { id: 'sympathy-anyone-002', occasion: 'sympathy', recipients: ['anyone'], tone: 'formal', tags: ['loss', 'memories', 'comfort'], text: 'With deepest sympathy. May your memories bring you comfort, and may you feel surrounded by love.' },
  { id: 'sympathy-anyone-003', occasion: 'sympathy', recipients: ['anyone'], tone: 'heartfelt', tags: ['loss', 'help', 'support'], text: "There are no right words, but please know I'm thinking of you and your family. If there is anything I can do, a meal, an errand or simply a listening ear, I'm here." },

  // Good luck
  { id: 'good-luck-anyone-001', occasion: 'good-luck', recipients: ['anyone'], tone: 'simple', tags: ['luck', 'confidence'], text: "Good luck! I know you'll do brilliantly." },
  { id: 'good-luck-anyone-002', occasion: 'good-luck', recipients: ['anyone'], tone: 'encouraging', tags: ['luck', 'ready'], text: "Wishing you the very best of luck. Take a deep breath. You're more ready than you think." },
  { id: 'good-luck-anyone-003', occasion: 'good-luck', recipients: ['anyone'], tone: 'casual', tags: ['adventure', 'new start'], text: "Good luck with your new adventure! I can't wait to hear all about it." },
  { id: 'good-luck-work-001', occasion: 'good-luck', recipients: WORK, tone: 'formal', tags: ['new job', 'work', 'success'], text: 'Wishing you every success in your new role. Best of luck.' },

  // Christmas
  { id: 'christmas-anyone-001', occasion: 'christmas', recipients: ['anyone'], tone: 'heartfelt', tags: ['christmas', 'family', 'warmth'], text: 'Merry Christmas! Wishing you a season full of warmth, laughter and time with the people you love.' },
  { id: 'christmas-anyone-002', occasion: 'christmas', recipients: ['anyone'], tone: 'sweet', tags: ['christmas', 'home'], text: 'Merry Christmas! May your home be cozy, your table full and your heart light.' },
  { id: 'christmas-family-001', occasion: 'christmas', recipients: ['family'], tone: 'sentimental', tags: ['christmas', 'family', 'traditions'], text: "Merry Christmas to my wonderful family. Thank you for the traditions, the laughter and the love that make this time of year so special. I'm grateful for every one of you." },
  { id: 'christmas-anyone-003', occasion: 'christmas', recipients: ['anyone'], tone: 'playful', tags: ['christmas', 'cookies', 'humor'], text: 'Merry Christmas! I hope you get everything on your list, plus at least one extra cookie.' },
  { id: 'christmas-work-001', occasion: 'christmas', recipients: [...WORK, 'anyone'], tone: 'formal', tags: ['christmas', 'new year'], text: 'Warm wishes for a peaceful Christmas and a happy New Year.' },

  // New Year
  { id: 'new-year-anyone-001', occasion: 'new-year', recipients: ['anyone'], tone: 'simple', tags: ['new year', 'health'], text: 'Happy New Year! Wishing you health, happiness and many good moments in the year ahead.' },
  { id: 'new-year-anyone-002', occasion: 'new-year', recipients: ['anyone'], tone: 'inspirational', tags: ['new year', 'fresh start'], text: "Here's to a fresh start and a year full of good things. Happy New Year!" },
  { id: 'new-year-anyone-003', occasion: 'new-year', recipients: ['anyone'], tone: 'heartfelt', tags: ['new year', 'memories', 'friendship'], text: "Happy New Year! Thank you for being part of my life this past year. I can't wait to make more memories with you in the year ahead." },
  { id: 'new-year-work-001', occasion: 'new-year', recipients: WORK, tone: 'professional', tags: ['new year', 'work'], text: "Wishing you a happy and successful New Year. It's been a pleasure working with you." },

  // Just because
  { id: 'just-because-anyone-001', occasion: 'just-because', recipients: ['anyone'], tone: 'heartfelt', tags: ['appreciation'], text: 'No reason, really. I just wanted to remind you how much you mean to me.' },
  { id: 'just-because-anyone-002', occasion: 'just-because', recipients: ['anyone'], tone: 'sweet', tags: ['sunshine', 'hello'], text: 'Hello! Sending a little sunshine your way today.' },
  { id: 'just-because-anyone-003', occasion: 'just-because', recipients: ['anyone'], tone: 'playful', tags: ['compliment'], text: "Just because: you're wonderful, and someone should tell you that more often." },
  { id: 'just-because-anyone-004', occasion: 'just-because', recipients: ['anyone'], tone: 'sentimental', tags: ['smile', 'appreciation'], text: 'I was thinking about you today and smiled. Thank you for being the kind of person who makes life better just by being in it. I hope this little card brightens your day.' },
  { id: 'just-because-anyone-005', occasion: 'just-because', recipients: ['anyone'], tone: 'funny', tags: ['smile', 'humor'], text: 'This card has no special purpose except to make you smile. Is it working?' },
]

/** short: under 100 characters; medium: up to 220; long: anything longer (still within the 500 limit). */
export function lengthOf(text: string): MessageLength {
  if (text.length < 100) return 'short'
  if (text.length <= 220) return 'medium'
  return 'long'
}

export const messageLibrary: LibraryMessage[] = sources.map((message) => ({ ...message, length: lengthOf(message.text), language: 'en' }))
